/**
 * Idempotent seed importer: reads a migration-format JSON export
 * (Docs/ASANA-MIGRATION-DATA-FORMAT.md) and seeds it into an EXISTING
 * workspace/projects. Never creates workspaces or projects — only fills in
 * missing sections, tasks, and comments, matched by exact name/title so
 * reruns (or overlapping exports) don't create duplicates. Dry-run by
 * default; pass --commit to actually write. Plain data inserts only (no
 * notify()/activity-log/pusher calls) — this is a historical backfill tool,
 * not a live-creation path.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/import-migration-json.ts <jsonPath> [--workspace "Name"] [--commit]
 */
import mongoose from "mongoose";
import fs from "fs";
import path from "path";

try {
  (process as unknown as { loadEnvFile?: (p: string) => void }).loadEnvFile?.(".env.local");
} catch {
  /* noop */
}

const POSITION_STEP = 1000;

// Known duplicate/personal emails in source exports -> canonical account.
const EMAIL_OVERRIDES: Record<string, string> = {
  "shrinjayshresth@gmail.com": "shrinjayshresth@gg.ai",
};

// Used when a task's createdBy can't be resolved at all.
const FALLBACK_CREATOR_EMAIL = "mohdsarfaraz@gg.ai";

// Real assignees in this dataset with no account yet — created once, idempotently.
const PLACEHOLDER_USERS: { email: string; name: string; role: string }[] = [
  { email: "amanhas4700@gmail.com", name: "Aman", role: "GUEST" },
];

type JsonComment = { author: string; body: string; createdAt?: string };
type JsonTask = {
  title: string;
  description?: string | null;
  status?: string;
  priority?: string;
  type?: string;
  assignees?: string[];
  dueDate?: string | null;
  startDate?: string | null;
  completedAt?: string | null;
  createdBy?: string | null;
  subtasks?: JsonTask[];
  comments?: JsonComment[];
};
type JsonSection = { name: string; tasks: JsonTask[] };
type JsonProject = { name: string; description?: string | null; sections: JsonSection[] };
type JsonExport = {
  workspace: { name: string; description?: string | null };
  members: { name: string; email: string; role?: string }[];
  labels: { name: string; color?: string | null }[];
  projects: JsonProject[];
};

function normEmail(email: string): string {
  const lower = email.toLowerCase();
  return (EMAIL_OVERRIDES[lower] ?? lower).toLowerCase();
}

function commentKey(authorId: string | null, body: string, createdAt: Date): string {
  const minute = new Date(createdAt);
  minute.setSeconds(0, 0);
  return `${authorId}::${body.trim()}::${minute.toISOString()}`;
}

async function main() {
  const args = process.argv.slice(2);
  const commit = args.includes("--commit");
  const wsFlagIdx = args.indexOf("--workspace");
  const workspaceName = wsFlagIdx >= 0 ? args[wsFlagIdx + 1] : "GG-sprint";
  const jsonPath = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--workspace");
  if (!jsonPath) {
    console.error('Usage: import-migration-json.ts <jsonPath> [--workspace "Name"] [--commit]');
    process.exit(1);
  }

  const data: JsonExport = JSON.parse(fs.readFileSync(path.resolve(jsonPath), "utf8"));

  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI || MONGODB_URI.includes("placeholder")) {
    console.error("Set a real MONGODB_URI in my-app/.env.local first.");
    process.exit(1);
  }
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection;

  const ws = await db.collection("workspaces").findOne({ name: workspaceName });
  if (!ws) throw new Error(`Workspace "${workspaceName}" not found — refusing to auto-create.`);
  // Capture a non-null ref so nested closures keep the narrowing.
  const wsId = ws._id as mongoose.Types.ObjectId;

  console.log(`${commit ? "COMMIT" : "DRY RUN"} — workspace "${ws.name}" (${wsId})\n`);

  const summary = {
    newUsers: [] as string[],
    newSections: [] as string[],
    newTasks: [] as string[],
    skippedTasks: [] as string[],
    newComments: 0,
    unresolvedRefs: [] as string[],
    missingProjects: [] as string[],
  };

  // ---- Placeholder users (created once, idempotent) ----
  const userCache = new Map<string, mongoose.Types.ObjectId | null>();

  for (const placeholder of PLACEHOLDER_USERS) {
    const email = normEmail(placeholder.email);
    let user = await db.collection("users").findOne({ email });
    if (!user) {
      summary.newUsers.push(email);
      if (commit) {
        const now = new Date();
        const inserted = await db.collection("users").insertOne({
          name: placeholder.name,
          email,
          image: null,
          passwordHash: null,
          authVersion: 0,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
        user = { _id: inserted.insertedId };
      }
    }
    const userId = user ? (user._id as mongoose.Types.ObjectId) : null;
    userCache.set(email, userId);

    if (commit && userId) {
      const existingMember = await db
        .collection("workspacemembers")
        .findOne({ workspaceId: wsId, userId });
      if (!existingMember) {
        const now = new Date();
        await db.collection("workspacemembers").insertOne({
          workspaceId: wsId,
          userId,
          role: placeholder.role,
          status: "ACTIVE",
          invitedBy: null,
          joinedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }

  async function resolveUser(rawEmail: string | null | undefined): Promise<mongoose.Types.ObjectId | null> {
    if (!rawEmail) return null;
    const email = normEmail(rawEmail);
    if (userCache.has(email)) return userCache.get(email) ?? null;
    const u = await db.collection("users").findOne({ email });
    const id = u ? (u._id as mongoose.Types.ObjectId) : null;
    userCache.set(email, id);
    if (!id) summary.unresolvedRefs.push(rawEmail);
    return id;
  }

  async function resolveCreator(rawEmail: string | null | undefined): Promise<mongoose.Types.ObjectId> {
    const id = await resolveUser(rawEmail ?? undefined);
    if (id) return id;
    const fallback = await resolveUser(FALLBACK_CREATOR_EMAIL);
    if (!fallback) throw new Error("Fallback creator user not found — aborting.");
    return fallback;
  }

  async function importComments(
    project: { _id: mongoose.Types.ObjectId },
    taskId: mongoose.Types.ObjectId,
    comments: JsonComment[] | undefined,
  ) {
    if (!comments || comments.length === 0) return;
    const existing = await db.collection("comments").find({ taskId }).toArray();
    const existingKeys = new Set(
      existing.map((c) => commentKey(c.authorId ? String(c.authorId) : null, c.body, c.createdAt)),
    );
    for (const c of comments) {
      const authorId = await resolveUser(c.author);
      const createdAt = c.createdAt ? new Date(c.createdAt) : new Date();
      const key = commentKey(authorId ? String(authorId) : null, c.body, createdAt);
      if (existingKeys.has(key)) continue;
      summary.newComments++;
      existingKeys.add(key);
      if (!commit) continue;
      if (!authorId) {
        summary.unresolvedRefs.push(`comment author (dropped): ${c.author}`);
        continue;
      }
      await db.collection("comments").insertOne({
        workspaceId: wsId,
        projectId: project._id,
        taskId,
        authorId,
        body: c.body,
        mentionedUserIds: [],
        parentCommentId: null,
        deletedAt: null,
        createdAt,
        updatedAt: createdAt,
      });
    }
  }

  async function insertTask(
    project: { _id: mongoose.Types.ObjectId },
    sectionId: mongoose.Types.ObjectId | null,
    parentTaskId: mongoose.Types.ObjectId | null,
    taskJson: JsonTask,
    position: number,
  ): Promise<mongoose.Types.ObjectId | null> {
    if (!commit) return null;
    const assigneeIds = (await Promise.all((taskJson.assignees ?? []).map((e) => resolveUser(e)))).filter(
      (id): id is mongoose.Types.ObjectId => id !== null,
    );
    const createdBy = await resolveCreator(taskJson.createdBy);
    const now = new Date();
    const inserted = await db.collection("tasks").insertOne({
      workspaceId: wsId,
      projectId: project._id,
      sectionId,
      parentTaskId,
      title: taskJson.title,
      description: taskJson.description ?? null,
      status: taskJson.status ?? "TODO",
      priority: taskJson.priority ?? "MEDIUM",
      type: taskJson.type ?? "TASK",
      assigneeIds,
      labelIds: [],
      dueDate: taskJson.dueDate ? new Date(taskJson.dueDate) : null,
      startDate: taskJson.startDate ? new Date(taskJson.startDate) : null,
      completedAt: taskJson.completedAt ? new Date(taskJson.completedAt) : null,
      createdBy,
      updatedBy: null,
      isArchived: false,
      position,
      recurrenceRule: null,
      recurrenceParentId: null,
      createdAt: now,
      updatedAt: now,
    });
    return inserted.insertedId;
  }

  // ---- Projects / sections / tasks ----
  for (const projectJson of data.projects ?? []) {
    const project = await db.collection("projects").findOne({ workspaceId: wsId, name: projectJson.name });
    if (!project) {
      summary.missingProjects.push(projectJson.name);
      console.log(`SKIP project "${projectJson.name}" — not found under workspace.`);
      continue;
    }
    console.log(`--- Project: ${project.name} ---`);

    const existingSections = await db.collection("sections").find({ projectId: project._id }).toArray();
    const sectionByName = new Map<string, { _id: mongoose.Types.ObjectId | null; name: string; position: number }>(
      existingSections.map((s) => [String(s.name).toLowerCase(), s as never]),
    );
    let maxSectionPos = existingSections.reduce((m, s) => Math.max(m, s.position ?? 0), 0);

    const existingTasks = await db
      .collection("tasks")
      .find({ projectId: project._id, parentTaskId: null })
      .toArray();
    const taskByTitle = new Map(existingTasks.map((t) => [String(t.title).trim().toLowerCase(), t]));

    for (const sectionJson of projectJson.sections ?? []) {
      const sectionKey = sectionJson.name.toLowerCase();
      let section = sectionByName.get(sectionKey) ?? null;
      if (!section) {
        maxSectionPos += POSITION_STEP;
        summary.newSections.push(`${project.name} / ${sectionJson.name}`);
        if (commit) {
          const now = new Date();
          const inserted = await db.collection("sections").insertOne({
            workspaceId: wsId,
            projectId: project._id,
            name: sectionJson.name,
            position: maxSectionPos,
            createdAt: now,
            updatedAt: now,
          });
          section = { _id: inserted.insertedId, name: sectionJson.name, position: maxSectionPos };
        } else {
          section = { _id: null, name: sectionJson.name, position: maxSectionPos };
        }
        sectionByName.set(sectionKey, section);
      }
      const sectionId = section._id;

      let maxTaskPos = existingTasks
        .filter((t) => String(t.sectionId ?? "") === String(sectionId ?? ""))
        .reduce((m, t) => Math.max(m, t.position ?? 0), 0);

      for (const taskJson of sectionJson.tasks ?? []) {
        const titleKey = taskJson.title.trim().toLowerCase();
        const existingTask = taskByTitle.get(titleKey);

        if (existingTask) {
          summary.skippedTasks.push(`${project.name} / ${taskJson.title}`);
          await importComments(project as { _id: mongoose.Types.ObjectId }, existingTask._id, taskJson.comments);
          continue;
        }

        maxTaskPos += POSITION_STEP;
        summary.newTasks.push(`${project.name} / ${sectionJson.name} / ${taskJson.title}`);
        const newTaskId = await insertTask(
          project as { _id: mongoose.Types.ObjectId },
          sectionId,
          null,
          taskJson,
          maxTaskPos,
        );

        if (commit && newTaskId) {
          taskByTitle.set(titleKey, { _id: newTaskId, title: taskJson.title, sectionId, position: maxTaskPos });

          let subPos = 0;
          for (const subJson of taskJson.subtasks ?? []) {
            subPos += POSITION_STEP;
            const subId = await insertTask(
              project as { _id: mongoose.Types.ObjectId },
              sectionId,
              newTaskId,
              subJson,
              subPos,
            );
            if (subId) await importComments(project as { _id: mongoose.Types.ObjectId }, subId, subJson.comments);
          }
          await importComments(project as { _id: mongoose.Types.ObjectId }, newTaskId, taskJson.comments);
        } else if (!commit) {
          // Dry run: still count expected comments for genuinely new tasks.
          summary.newComments += taskJson.comments?.length ?? 0;
          for (const subJson of taskJson.subtasks ?? []) {
            summary.newComments += subJson.comments?.length ?? 0;
          }
        }
      }
    }
  }

  console.log("\n=== SUMMARY ===");
  console.log(`New sections: ${summary.newSections.length}`);
  summary.newSections.forEach((s) => console.log("  + " + s));
  console.log(`New tasks: ${summary.newTasks.length}`);
  summary.newTasks.forEach((t) => console.log("  + " + t));
  console.log(`Skipped (already exist): ${summary.skippedTasks.length}`);
  console.log(`New/backfilled comments: ${summary.newComments}`);
  console.log(`New users: ${summary.newUsers.length}`, summary.newUsers);
  if (summary.missingProjects.length) console.log("Missing projects (skipped):", summary.missingProjects);
  if (summary.unresolvedRefs.length) console.log("Unresolved refs (dropped):", summary.unresolvedRefs);
  console.log(commit ? "\nCommitted." : "\nDRY RUN — nothing written. Re-run with --commit to apply.");

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
