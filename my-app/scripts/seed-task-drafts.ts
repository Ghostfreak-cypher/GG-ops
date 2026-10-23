/**
 * Demo seed: a handful of AI-suggested task drafts so /w/<slug>/drafts has something real
 * to review — spanning the states a reviewer actually sees: high vs. low confidence,
 * project/assignee already resolved vs. left blank for the human to fill in, with and
 * without a due date.
 *
 * Usage (from my-app/):
 *   npm run db:seed-task-drafts
 *   DRAFTS_WS_SLUG=other-slug npm run db:seed-task-drafts
 *
 * Idempotent — upserts on {workspaceId, sourceMeetingId, title}, the same compound the
 * model's dedupe index uses. Deliberately does NOT touch `status` on an existing row: if
 * you've already approved or rejected a seeded draft while testing, re-running this script
 * leaves that decision alone instead of resetting it back to PENDING.
 */
try {
  (process as unknown as { loadEnvFile?: (p: string) => void }).loadEnvFile?.(".env.local");
} catch {
  /* env may already be set in the shell */
}

import mongoose from "mongoose";
import { TaskDraft } from "@/models/TaskDraft";
import { Workspace } from "@/models/Workspace";
import { WorkspaceMember } from "@/models/WorkspaceMember";
import { Project } from "@/models/Project";
import { User } from "@/models/User";
import { canEditTasks } from "@/modules/workspace/server/permissions";
import type { WorkspaceRole } from "@/modules/workspace/roles";
import type { TaskPriority } from "@/modules/task/constants";

const MONGODB_URI = process.env.MONGODB_URI;
const WS_SLUG = process.env.DRAFTS_WS_SLUG ?? "genegeniius-sprint";

/** The same smoke-test roster seed-dsr.ts uses — reused here as candidate assignees. */
const ASSIGNEE_EMAILS = ["engineer@smoke.test", "sagar@smoke.test", "vansh@smoke.test"];

type DraftPlan = {
  meetingId: string;
  meetingTitle: string;
  daysAgo: number;
  title: string;
  description: string;
  priority: TaskPriority;
  dueInDays: number | null;
  confidence: number;
  sourceExcerpt: string;
  /** Only the high-confidence entries get a project/assignee already resolved — the AI
   *  doesn't always know, and that's the state a reviewer most needs to see. */
  withProject: boolean;
  assigneeEmail: string | null;
};

const PLANS: DraftPlan[] = [
  {
    meetingId: "demo-growth-sync",
    meetingTitle: "Growth Team Sync",
    daysAgo: 2,
    title: "Fix checkout timeout on mobile",
    description:
      "Mobile checkout is timing out for a chunk of users right before the promo launches — " +
      "needs a look before traffic ramps up.",
    priority: "HIGH",
    dueInDays: 3,
    confidence: 0.91,
    sourceExcerpt:
      "We're losing about 4% of mobile checkouts to a timeout — someone needs to look at " +
      "that before the promo goes live.",
    withProject: true,
    assigneeEmail: "engineer@smoke.test",
  },
  {
    meetingId: "demo-growth-sync",
    meetingTitle: "Growth Team Sync",
    daysAgo: 2,
    title: "Write up the promo launch checklist",
    description: "A shared checklist so launch day doesn't turn into a scramble again.",
    priority: "MEDIUM",
    dueInDays: 5,
    confidence: 0.74,
    sourceExcerpt: "Can someone put together a checklist before Friday so we don't scramble again?",
    withProject: false,
    assigneeEmail: null,
  },
  {
    meetingId: "demo-infra-weekly",
    meetingTitle: "Infra Weekly",
    daysAgo: 1,
    title: "Investigate Atlas connection pool warnings",
    description: "Staging keeps logging pool-exhaustion warnings — worth root-causing before it hits prod.",
    priority: "HIGH",
    dueInDays: 2,
    confidence: 0.88,
    sourceExcerpt:
      "We keep seeing pool exhaustion warnings in staging, worth digging into before it hits prod.",
    withProject: true,
    assigneeEmail: "sagar@smoke.test",
  },
  {
    meetingId: "demo-infra-weekly",
    meetingTitle: "Infra Weekly",
    daysAgo: 1,
    title: "Document the API key rotation runbook",
    description: "Currently tribal knowledge — write it down so it survives someone being out.",
    priority: "LOW",
    dueInDays: null,
    confidence: 0.62,
    sourceExcerpt: "We should probably write this down somewhere, it's tribal knowledge right now.",
    withProject: false,
    assigneeEmail: null,
  },
  {
    meetingId: "demo-roadmap-review",
    meetingTitle: "Leadership Roadmap Review",
    daysAgo: 4,
    title: "Scope the Q3 CRM pipeline work",
    description: "Early — needs a scoping pass before it can be broken into real tasks.",
    priority: "MEDIUM",
    dueInDays: null,
    confidence: 0.55,
    sourceExcerpt: "Not fully decided yet, but someone should start scoping this out.",
    withProject: false,
    assigneeEmail: null,
  },
  {
    meetingId: "demo-roadmap-review",
    meetingTitle: "Leadership Roadmap Review",
    daysAgo: 4,
    title: "Follow up with finance on the spend report budget",
    description: "Budget review is blocked on this — needs to close out before end of week.",
    priority: "HIGH",
    dueInDays: 1,
    confidence: 0.95,
    sourceExcerpt: "This needs to happen before end of week, budget review is blocked on it.",
    withProject: true,
    assigneeEmail: "vansh@smoke.test",
  },
];

function daysFromNow(offset: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d;
}

async function main() {
  if (!MONGODB_URI || MONGODB_URI.includes("placeholder")) {
    console.error("Set a real MONGODB_URI in my-app/.env.local (or your shell) before seeding.");
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);

  const workspace = await Workspace.findOne({ slug: WS_SLUG }).select("_id name").lean();
  if (!workspace) {
    console.error(`No workspace with slug "${WS_SLUG}". Set DRAFTS_WS_SLUG.`);
    process.exit(1);
  }

  // One resolved project to stand in for "the AI was confident" — real drafts vary task by
  // task, but for a demo seed one representative project is enough to show the state.
  const project = await Project.findOne({ workspaceId: workspace._id, archivedAt: null })
    .select("_id")
    .lean();
  if (!project) {
    console.warn(`  no active project in "${workspace.name}" — every draft will show blank.`);
  }

  // A bot-ish author. There's no seeded service account for this, so fall back to the first
  // active member who could actually create tasks — good enough for createdBy on a demo row.
  const authorCandidate = await WorkspaceMember.findOne({
    workspaceId: workspace._id,
    status: "ACTIVE",
  })
    .sort({ createdAt: 1 })
    .select("userId role")
    .lean();
  if (!authorCandidate || !canEditTasks(authorCandidate.role as WorkspaceRole)) {
    console.error(`No active member of "${workspace.name}" can author drafts. Seed that workspace first.`);
    process.exit(1);
  }

  const assigneeIds = new Map<string, string>();
  for (const email of ASSIGNEE_EMAILS) {
    const user = await User.findOne({ email }).select("_id").lean();
    if (!user) continue;
    const membership = await WorkspaceMember.findOne({
      workspaceId: workspace._id,
      userId: user._id,
      status: "ACTIVE",
    })
      .select("_id")
      .lean();
    if (membership) assigneeIds.set(email, String(user._id));
  }

  let written = 0;
  for (const plan of PLANS) {
    const assigneeId = plan.assigneeEmail ? assigneeIds.get(plan.assigneeEmail) : undefined;
    if (plan.assigneeEmail && !assigneeId) {
      console.warn(`  ${plan.title} — skipping assignee, ${plan.assigneeEmail} isn't an active member`);
    }

    await TaskDraft.findOneAndUpdate(
      { workspaceId: workspace._id, sourceMeetingId: plan.meetingId, title: plan.title },
      {
        $set: {
          projectId: plan.withProject ? (project?._id ?? null) : null,
          description: plan.description,
          priority: plan.priority,
          dueDate: plan.dueInDays !== null ? daysFromNow(plan.dueInDays) : null,
          assigneeIds: assigneeId ? [assigneeId] : [],
          confidence: plan.confidence,
          sourceMeetingTitle: plan.meetingTitle,
          sourceMeetingDate: daysFromNow(-plan.daysAgo).toISOString().slice(0, 10),
          sourceExcerpt: plan.sourceExcerpt,
          createdBy: authorCandidate.userId,
        },
      },
      { upsert: true, setDefaultsOnInsert: true },
    );
    written += 1;
  }

  console.log(`Seeded ${written} task draft(s) into "${workspace.name}".`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
