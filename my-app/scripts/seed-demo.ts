/**
 * Demo seed: one "Acme Corp" workspace with users, projects, tasks, dependencies,
 * goals, comments and a custom field. Run with: npm run db:seed-demo
 *
 * Refuses to run if the demo workspace already exists.
 * SEED_RESET=1 npm run db:seed-demo   wipes the demo workspace + demo users first.
 *
 * Every demo user signs in with Credentials, password: Demo1234!
 */
import mongoose, { Types } from "mongoose";
import bcrypt from "bcryptjs";
import { Workspace } from "../src/models/Workspace";
import { User } from "../src/models/User";
import { WorkspaceMember } from "../src/models/WorkspaceMember";
import { Project } from "../src/models/Project";
import { Section } from "../src/models/Section";
import { Task } from "../src/models/Task";
import { TaskDependency } from "../src/models/TaskDependency";
import { Label } from "../src/models/Label";
import { Comment } from "../src/models/Comment";
import { Goal } from "../src/models/Goal";
import { CustomField } from "../src/models/CustomField";
import { TaskFieldValue } from "../src/models/TaskFieldValue";
import type { TaskPriority, TaskStatus, TaskType } from "../src/modules/task/constants";

try {
  (process as unknown as { loadEnvFile?: (p: string) => void }).loadEnvFile?.(".env.local");
} catch {
  /* env may already be set in the shell */
}

const MONGODB_URI = process.env.MONGODB_URI;
const SLUG = "acme-corp";
const PASSWORD = "Demo1234!";
const EMAILS = ["alex", "sam", "jordan", "riley", "casey"].map((n) => `${n}@demo.acme`);

/** Date-only value `offset` days from today, at UTC midnight. */
const day = (offset: number) => {
  const dt = new Date();
  dt.setUTCHours(0, 0, 0, 0);
  dt.setUTCDate(dt.getUTCDate() + offset);
  return dt;
};

type TaskDef = {
  title: string;
  who: Types.ObjectId[];
  status?: TaskStatus;
  priority?: TaskPriority;
  type?: TaskType;
  labels?: Types.ObjectId[];
  start?: number;
  due?: number;
  desc?: string;
};

async function reset() {
  const ws = await Workspace.findOne({ slug: SLUG }).select("_id").lean();
  if (ws) {
    const scoped = { workspaceId: ws._id };
    await Promise.all([
      WorkspaceMember.deleteMany(scoped),
      Project.deleteMany(scoped),
      Section.deleteMany(scoped),
      Task.deleteMany(scoped),
      TaskDependency.deleteMany(scoped),
      Label.deleteMany(scoped),
      Comment.deleteMany(scoped),
      Goal.deleteMany(scoped),
      CustomField.deleteMany(scoped),
      TaskFieldValue.deleteMany(scoped),
    ]);
    await Workspace.deleteOne({ _id: ws._id });
  }
  await User.deleteMany({ email: { $in: EMAILS } });
}

async function main() {
  if (!MONGODB_URI || MONGODB_URI.includes("placeholder")) {
    console.error("Set a real MONGODB_URI in my-app/.env.local before seeding.");
    process.exit(1);
  }
  await mongoose.connect(MONGODB_URI);
  console.log(`Connected to "${mongoose.connection.name}"`);

  if (process.env.SEED_RESET === "1") await reset();
  else if (await Workspace.exists({ slug: SLUG })) {
    console.error(`Workspace "${SLUG}" already exists. Re-run with SEED_RESET=1 to replace it.`);
    process.exit(1);
  }

  // ── Users + workspace ────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const verified = new Date();
  const [alex, sam, jordan, riley, casey] = await User.insertMany([
    { name: "Alex Morgan", email: EMAILS[0], jobTitle: "Head of Product", timezone: "Asia/Kolkata" },
    { name: "Sam Rivera", email: EMAILS[1], jobTitle: "Product Designer", timezone: "Asia/Kolkata" },
    { name: "Jordan Lee", email: EMAILS[2], jobTitle: "Senior Engineer", timezone: "Asia/Kolkata" },
    { name: "Riley Chen", email: EMAILS[3], jobTitle: "QA Engineer", timezone: "Asia/Kolkata" },
    { name: "Casey Brooks", email: EMAILS[4], jobTitle: "Marketing Lead (contractor)", timezone: "Asia/Kolkata" },
  ].map((u) => ({ ...u, passwordHash, emailVerifiedAt: verified, isActive: true })));

  const ws = await Workspace.create({
    name: "Acme Corp",
    slug: SLUG,
    description: "Demo workspace with sample projects, tasks and goals.",
    ownerId: alex._id,
  });
  const workspaceId = ws._id;

  await WorkspaceMember.insertMany(
    [
      { user: alex, role: "MAINTAINER" },
      { user: sam, role: "ADMIN" },
      { user: jordan, role: "MEMBER" },
      { user: riley, role: "MEMBER" },
      { user: casey, role: "GUEST" },
    ].map(({ user, role }) => ({
      workspaceId,
      userId: user._id,
      role,
      status: "ACTIVE",
      invitedBy: alex._id,
      joinedAt: verified,
    })),
  );

  // ── Labels ───────────────────────────────────────────────────────────────
  const [lFront, lBack, lDesign, lBug, lP0] = await Label.insertMany(
    [
      ["Frontend", "#3b82f6"],
      ["Backend", "#10b981"],
      ["Design", "#f59e0b"],
      ["Bug", "#ef4444"],
      ["P0", "#7c3aed"],
    ].map(([name, color]) => ({ workspaceId, name, color, createdBy: alex._id })),
  );

  // ── Projects + sections ──────────────────────────────────────────────────
  const [web, mobile, marketing] = await Project.insertMany([
    {
      name: "Website Redesign", key: "WEB", icon: "🌐", color: "#3b82f6",
      description: "Rebuild the marketing site on Next.js with a new design system.",
      statusColor: "ON_TRACK", statusNote: "On schedule, launch in 3 weeks", statusUpdatedAt: day(-2),
    },
    {
      name: "Mobile App", key: "APP", icon: "📱", color: "#f97316",
      description: "iOS + Android companion app, first public release.",
      statusColor: "AT_RISK", statusNote: "Auth service is slipping and blocks two downstream tasks", statusUpdatedAt: day(-1),
    },
    {
      name: "Q4 Marketing", key: "MKT", icon: "📣", color: "#8b5cf6",
      description: "Year-end campaigns and the product launch email sequence.",
      statusColor: "ON_HOLD", statusNote: "Waiting on the brand refresh to complete", statusUpdatedAt: day(-5),
    },
  ].map((p) => ({ ...p, workspaceId, createdBy: alex._id })));

  const sectionsFor = async (projectId: Types.ObjectId, names: string[]) =>
    Section.insertMany(names.map((name, position) => ({ workspaceId, projectId, name, position })));
  const [wDesign, wDev, wQa] = await sectionsFor(web._id, ["Design", "Development", "QA & Launch"]);
  const [mS1, mS2] = await sectionsFor(mobile._id, ["Sprint 1", "Sprint 2"]);
  const [kCamp] = await sectionsFor(marketing._id, ["Campaigns"]);

  // ── Tasks ────────────────────────────────────────────────────────────────
  const byTitle = new Map<string, Types.ObjectId>();
  const taskId = (title: string) => {
    const id = byTitle.get(title);
    if (!id) throw new Error(`Unknown task: ${title}`);
    return id;
  };
  const addTasks = async (projectId: Types.ObjectId, sectionId: Types.ObjectId, defs: TaskDef[]) => {
    const docs = await Task.insertMany(
      defs.map((t, position) => {
        const status = t.status ?? "TODO";
        return {
          workspaceId, projectId, sectionId, position,
          title: t.title,
          description: t.desc ? `<p>${t.desc}</p>` : null,
          status,
          priority: t.priority ?? "MEDIUM",
          type: t.type ?? "TASK",
          assigneeIds: t.who,
          labelIds: t.labels ?? [],
          startDate: t.start === undefined ? null : day(t.start),
          dueDate: t.due === undefined ? null : day(t.due),
          completedAt: status === "DONE" ? day(t.due ?? -1) : null,
          createdBy: alex._id,
        };
      }),
    );
    docs.forEach((d) => byTitle.set(d.title, d._id));
  };

  await addTasks(web._id, wDesign._id, [
    { title: "Create new homepage wireframes", who: [sam._id], status: "DONE", priority: "HIGH", labels: [lDesign._id], start: -24, due: -14, desc: "Low-fi wireframes for desktop and mobile breakpoints." },
    { title: "Design component library (tokens, colors, type)", who: [sam._id], status: "IN_PROGRESS", priority: "HIGH", labels: [lDesign._id, lFront._id], start: -12, due: 4, desc: "Colour, spacing and typography tokens exported to Figma variables." },
    { title: "Prototype interactive navigation", who: [sam._id], priority: "MEDIUM", labels: [lDesign._id], start: 3, due: 12 },
    { title: "Brand refresh sign-off", who: [alex._id], type: "MILESTONE", priority: "HIGH", start: -3, due: 6 },
  ]);
  await addTasks(web._id, wDev._id, [
    { title: "Set up Next.js project structure", who: [jordan._id], status: "DONE", priority: "HIGH", labels: [lFront._id], start: -18, due: -10 },
    { title: "Implement header + navigation", who: [jordan._id], status: "IN_PROGRESS", priority: "HIGH", type: "FEATURE", labels: [lFront._id], start: -5, due: 7, desc: "Sticky header, mega-menu, and mobile drawer." },
    { title: "Build hero section with animations", who: [jordan._id], priority: "MEDIUM", type: "FEATURE", labels: [lFront._id], start: 5, due: 15 },
    { title: "Integrate CMS (Contentful)", who: [jordan._id], priority: "LOW", labels: [lBack._id], start: 12, due: 22 },
    { title: "Fix: footer links 404 on staging", who: [jordan._id, riley._id], priority: "HIGH", type: "BUG", labels: [lBug._id, lFront._id], start: -4, due: -1, desc: "Three footer links point at the old /company path." },
    { title: "Set up preview deployments", who: [jordan._id], status: "DONE", type: "CHORE", start: -14, due: -9 },
  ]);
  await addTasks(web._id, wQa._id, [
    { title: "Cross-browser testing", who: [riley._id], priority: "MEDIUM", labels: [lFront._id], start: 20, due: 27 },
    { title: "Performance audit (Core Web Vitals)", who: [jordan._id], priority: "HIGH", start: 22, due: 29 },
    { title: "Accessibility pass (WCAG AA)", who: [riley._id, sam._id], priority: "HIGH", start: 18, due: 28 },
    { title: "Launch day go / no-go", who: [alex._id], type: "MILESTONE", priority: "URGENT", due: 31 },
  ]);

  await addTasks(mobile._id, mS1._id, [
    { title: "Design onboarding flow (5 screens)", who: [sam._id], status: "DONE", priority: "URGENT", labels: [lDesign._id], start: -32, due: -22 },
    { title: "Auth service: JWT + refresh tokens", who: [jordan._id], status: "IN_PROGRESS", priority: "URGENT", type: "FEATURE", labels: [lBack._id, lP0._id], start: -12, due: -1, desc: "Refresh-token rotation with reuse detection. Running late." },
    { title: "Push notification setup (FCM)", who: [jordan._id], status: "BLOCKED", priority: "HIGH", labels: [lBack._id], start: 4, due: 14, desc: "Blocked until the auth service lands." },
    { title: "Crash on deep link navigation", who: [jordan._id, riley._id], priority: "URGENT", type: "BUG", labels: [lBug._id, lP0._id], start: -2, due: 1 },
  ]);
  await addTasks(mobile._id, mS2._id, [
    { title: "Dashboard screen implementation", who: [jordan._id, sam._id], status: "BLOCKED", priority: "HIGH", type: "FEATURE", labels: [lFront._id], start: 8, due: 18 },
    { title: "Offline mode for task list", who: [jordan._id], priority: "MEDIUM", type: "FEATURE", labels: [lFront._id, lBack._id], start: 14, due: 26 },
    { title: "App store submission prep", who: [sam._id, alex._id], priority: "MEDIUM", start: 20, due: 30, desc: "Screenshots, store copy, privacy questionnaire." },
    { title: "Beta release to TestFlight", who: [alex._id], type: "MILESTONE", priority: "HIGH", due: 24 },
  ]);

  await addTasks(marketing._id, kCamp._id, [
    { title: "Q4 content calendar", who: [casey._id], priority: "MEDIUM", start: 6, due: 20 },
    { title: "Launch email sequence (5-email drip)", who: [casey._id, alex._id], priority: "HIGH", start: 12, due: 26 },
    { title: "Year-end customer newsletter", who: [casey._id], priority: "LOW", start: 25, due: 40 },
    { title: "Case study: Acme x Globex", who: [casey._id], status: "DONE", priority: "MEDIUM", start: -20, due: -6 },
  ]);

  // Subtasks under one parent so the nested view has something to show.
  const parent = taskId("Implement header + navigation");
  await Task.insertMany(
    [
      ["Desktop mega-menu", "DONE"],
      ["Mobile drawer", "IN_PROGRESS"],
      ["Keyboard + screen-reader support", "TODO"],
    ].map(([title, status], position) => ({
      workspaceId, projectId: web._id, sectionId: wDev._id, parentTaskId: parent,
      title, status, position, assigneeIds: [jordan._id], createdBy: alex._id,
      completedAt: status === "DONE" ? day(-1) : null,
    })),
  );

  // ── Dependencies (fromTask is blocked by toTask) ─────────────────────────
  const blocks: [string, string][] = [
    ["Implement header + navigation", "Design component library (tokens, colors, type)"],
    ["Build hero section with animations", "Implement header + navigation"],
    ["Dashboard screen implementation", "Auth service: JWT + refresh tokens"],
    ["Push notification setup (FCM)", "Auth service: JWT + refresh tokens"],
    ["Dashboard screen implementation", "Design onboarding flow (5 screens)"],
    ["Launch email sequence (5-email drip)", "Brand refresh sign-off"],
    ["Launch day go / no-go", "Accessibility pass (WCAG AA)"],
  ];
  await TaskDependency.insertMany(
    blocks.map(([from, to]) => ({ workspaceId, fromTaskId: taskId(from), toTaskId: taskId(to), type: "BLOCKS", createdBy: alex._id })),
  );

  // ── Custom field: Story Points on Mobile App ─────────────────────────────
  const points = await CustomField.create({
    workspaceId, projectId: mobile._id, name: "Story Points", type: "NUMBER", options: [], position: 0, createdBy: alex._id,
  });
  await TaskFieldValue.insertMany(
    ([
      ["Auth service: JWT + refresh tokens", 8],
      ["Push notification setup (FCM)", 5],
      ["Dashboard screen implementation", 13],
      ["Crash on deep link navigation", 3],
      ["Offline mode for task list", 8],
    ] as [string, number][]).map(([title, value]) => ({ workspaceId, taskId: taskId(title), fieldId: points._id, value })),
  );

  // ── Goals ────────────────────────────────────────────────────────────────
  await Goal.insertMany([
    { title: "Launch the new website", status: "ON_TRACK", progress: 55, linkedProjectIds: [web._id], ownerId: alex._id, teamLabel: "Product", dueDate: day(31), description: "Public launch with Core Web Vitals in the green." },
    { title: "Ship mobile app v1.0", status: "AT_RISK", progress: 30, linkedProjectIds: [mobile._id], ownerId: jordan._id, teamLabel: "Engineering", dueDate: day(45), description: "TestFlight beta, then App Store + Play Store." },
    { title: "Grow newsletter to 5,000 subscribers", status: "OFF_TRACK", progress: 15, linkedProjectIds: [marketing._id], ownerId: casey._id, teamLabel: "Marketing", dueDate: day(70) },
  ].map((g) => ({ ...g, workspaceId, period: "2026-Q4" })));

  // ── Comments ─────────────────────────────────────────────────────────────
  const authTask = taskId("Auth service: JWT + refresh tokens");
  const comments: [Types.ObjectId, Types.ObjectId, Types.ObjectId, string, Types.ObjectId[]][] = [
    [mobile._id, authTask, jordan._id, "Refresh-token rotation works locally. Still writing the reuse-detection tests, so this will slip a day or two.", []],
    [mobile._id, authTask, alex._id, "@Jordan Please add rate limiting on the refresh endpoint. We got burned by this before.", [jordan._id]],
    [mobile._id, authTask, sam._id, "Dashboard designs are ready the moment this lands. Ping me and I will hand off.", []],
    [web._id, taskId("Implement header + navigation"), sam._id, "@Jordan header frames are final in Figma, mobile breakpoints included.", [jordan._id]],
    [web._id, taskId("Fix: footer links 404 on staging"), riley._id, "Reproduced on Safari and Chrome. @Jordan the three broken links are Careers, Press and Contact.", [jordan._id]],
    [marketing._id, taskId("Launch email sequence (5-email drip)"), alex._id, "@Casey draft copy for emails 1 and 2 by next Friday, please.", [casey._id]],
  ];
  await Comment.insertMany(
    comments.map(([projectId, tId, authorId, body, mentionedUserIds]) => ({
      workspaceId, projectId, taskId: tId, authorId, body: `<p>${body}</p>`, mentionedUserIds,
    })),
  );

  const [tasks, deps] = await Promise.all([
    Task.countDocuments({ workspaceId }),
    TaskDependency.countDocuments({ workspaceId }),
  ]);
  console.log(`Seeded: 5 users, 3 projects, ${tasks} tasks, ${deps} dependencies, 3 goals, ${comments.length} comments`);
  console.log(`\nSign in at /sign-in as alex@demo.acme (workspace maintainer), password ${PASSWORD}`);
  console.log(`Other users: sam / jordan / riley / casey @demo.acme   ->   /w/${SLUG}`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
