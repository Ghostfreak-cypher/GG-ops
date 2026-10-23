/**
 * Demo seed script — run once to populate a workspace with realistic demo data.
 *
 * Usage (from repo root):
 *   cd my-app && npx tsx ../scripts/seed-demo.ts
 *
 * Requires MONGODB_URI in my-app/.env.local (or env)
 */

import mongoose, { Types } from "mongoose";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

// Load .env.local from my-app/ directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../my-app/.env.local") });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI not set. Create my-app/.env.local with MONGODB_URI=...");
  process.exit(1);
}

// ── Model imports (must come after dotenv config) ──────────────────────────
const { Workspace } = await import("../my-app/src/models/Workspace.js");
const { User } = await import("../my-app/src/models/User.js");
const { WorkspaceMember } = await import("../my-app/src/models/WorkspaceMember.js");
const { Project } = await import("../my-app/src/models/Project.js");
const { Section } = await import("../my-app/src/models/Section.js");
const { Task } = await import("../my-app/src/models/Task.js");
const { TaskDependency } = await import("../my-app/src/models/TaskDependency.js");
const { Label } = await import("../my-app/src/models/Label.js");
const { Comment } = await import("../my-app/src/models/Comment.js");
const { CustomField } = await import("../my-app/src/models/CustomField.js");
const { TaskFieldValue } = await import("../my-app/src/models/TaskFieldValue.js");

// ──────────────────────────────────────────────────────────────────────────

async function main() {
  await mongoose.connect(MONGODB_URI!);
  console.log("✓ Connected to MongoDB");

  // ─── Users ───────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("Demo1234!", 10);

  const users = await User.insertMany([
    { name: "Alex (Admin)", email: "alex@demo.acme", passwordHash, isActive: true },
    { name: "Sam (Designer)", email: "sam@demo.acme", passwordHash, isActive: true },
    { name: "Jordan (Engineer)", email: "jordan@demo.acme", passwordHash, isActive: true },
    { name: "Casey (Guest)", email: "casey@demo.acme", passwordHash, isActive: true },
  ]);
  const [admin, designer, engineer, guest] = users;
  console.log("✓ Created 4 users");

  // ─── Workspace ───────────────────────────────────────────────────────────
  const ws = await Workspace.create({
    name: "Acme Corp",
    slug: "acme-corp",
    description: "Acme Corp demo workspace",
    ownerId: admin._id,
  });
  const wsId = ws._id as Types.ObjectId;
  console.log("✓ Created workspace: Acme Corp (slug: acme-corp)");

  // ─── Members ─────────────────────────────────────────────────────────────
  await WorkspaceMember.insertMany([
    { workspaceId: wsId, userId: admin._id, role: "OWNER", status: "ACTIVE", joinedAt: new Date() },
    { workspaceId: wsId, userId: designer._id, role: "ADMIN", status: "ACTIVE", joinedAt: new Date() },
    { workspaceId: wsId, userId: engineer._id, role: "MEMBER", status: "ACTIVE", joinedAt: new Date() },
    { workspaceId: wsId, userId: guest._id, role: "GUEST", status: "ACTIVE", joinedAt: new Date() },
  ]);
  console.log("✓ Added 4 members");

  // ─── Labels ──────────────────────────────────────────────────────────────
  const labelDocs = await Label.insertMany([
    { workspaceId: wsId, name: "Frontend", color: "#3b82f6", createdBy: admin._id },
    { workspaceId: wsId, name: "Backend", color: "#10b981", createdBy: admin._id },
    { workspaceId: wsId, name: "Design", color: "#f59e0b", createdBy: admin._id },
    { workspaceId: wsId, name: "Bug", color: "#ef4444", createdBy: admin._id },
    { workspaceId: wsId, name: "P0", color: "#7c3aed", createdBy: admin._id },
  ]);
  const [lFrontend, lBackend, lDesign, lBug] = labelDocs;

  // ─── Projects ────────────────────────────────────────────────────────────
  const [projWebsite, projMobile, projMarketing] = await Project.insertMany([
    {
      workspaceId: wsId, name: "Website Redesign", color: "#3b82f6", icon: "🌐",
      statusColor: "ON_TRACK", statusNote: "On schedule — launch in 3 weeks",
      createdBy: admin._id,
    },
    {
      workspaceId: wsId, name: "Mobile App", color: "#f97316", icon: "📱",
      statusColor: "AT_RISK", statusNote: "Auth integration blocked — see dependencies",
      createdBy: admin._id,
    },
    {
      workspaceId: wsId, name: "Q3 Marketing", color: "#8b5cf6", icon: "📣",
      statusColor: "ON_HOLD", statusNote: "Waiting on brand refresh to complete",
      createdBy: admin._id,
    },
  ]);
  console.log("✓ Created 3 projects");

  // ─── Sections: Website Redesign ──────────────────────────────────────────
  const [wSec1, wSec2, wSec3] = await Section.insertMany([
    { workspaceId: wsId, projectId: projWebsite._id, name: "Design", position: 0 },
    { workspaceId: wsId, projectId: projWebsite._id, name: "Development", position: 1 },
    { workspaceId: wsId, projectId: projWebsite._id, name: "QA", position: 2 },
  ]);

  // ─── Sections: Mobile App ────────────────────────────────────────────────
  const [mSec1, mSec2] = await Section.insertMany([
    { workspaceId: wsId, projectId: projMobile._id, name: "Sprint 1", position: 0 },
    { workspaceId: wsId, projectId: projMobile._id, name: "Sprint 2", position: 1 },
  ]);

  // ─── Sections: Marketing ─────────────────────────────────────────────────
  const [mkSec1] = await Section.insertMany([
    { workspaceId: wsId, projectId: projMarketing._id, name: "Campaigns", position: 0 },
  ]);

  // Helper to create dates relative to today
  const d = (offset: number) => {
    const dt = new Date();
    dt.setDate(dt.getDate() + offset);
    return dt;
  };

  // ─── Tasks: Website Redesign ─────────────────────────────────────────────
  const websiteTasks = await Task.insertMany([
    // Design section
    {
      workspaceId: wsId, projectId: projWebsite._id, sectionId: wSec1._id,
      title: "Create new homepage wireframes", status: "DONE", priority: "HIGH",
      assigneeIds: [designer._id], labelIds: [lDesign._id],
      startDate: d(-20), dueDate: d(-10),
      createdBy: admin._id, position: 0,
    },
    {
      workspaceId: wsId, projectId: projWebsite._id, sectionId: wSec1._id,
      title: "Design component library (tokens, colors, typography)", status: "IN_PROGRESS", priority: "HIGH",
      assigneeIds: [designer._id], labelIds: [lDesign._id, lFrontend._id],
      startDate: d(-10), dueDate: d(5),
      createdBy: admin._id, position: 1,
    },
    {
      workspaceId: wsId, projectId: projWebsite._id, sectionId: wSec1._id,
      title: "Prototype interactive navigation", status: "TODO", priority: "MEDIUM",
      assigneeIds: [designer._id], labelIds: [lDesign._id],
      startDate: d(3), dueDate: d(12),
      createdBy: admin._id, position: 2,
    },
    // Dev section
    {
      workspaceId: wsId, projectId: projWebsite._id, sectionId: wSec2._id,
      title: "Set up Next.js project structure", status: "DONE", priority: "HIGH",
      assigneeIds: [engineer._id], labelIds: [lFrontend._id],
      startDate: d(-15), dueDate: d(-8),
      createdBy: admin._id, position: 0,
    },
    {
      workspaceId: wsId, projectId: projWebsite._id, sectionId: wSec2._id,
      title: "Implement header + navigation component", status: "IN_PROGRESS", priority: "HIGH",
      assigneeIds: [engineer._id], labelIds: [lFrontend._id],
      startDate: d(-5), dueDate: d(7),
      createdBy: admin._id, position: 1,
    },
    {
      workspaceId: wsId, projectId: projWebsite._id, sectionId: wSec2._id,
      title: "Build hero section with animations", status: "TODO", priority: "MEDIUM",
      assigneeIds: [engineer._id], labelIds: [lFrontend._id],
      startDate: d(5), dueDate: d(15),
      createdBy: admin._id, position: 2,
    },
    {
      workspaceId: wsId, projectId: projWebsite._id, sectionId: wSec2._id,
      title: "Integrate CMS (Contentful)", status: "TODO", priority: "LOW",
      assigneeIds: [engineer._id], labelIds: [lBackend._id],
      startDate: d(12), dueDate: d(22),
      createdBy: admin._id, position: 3,
    },
    // QA section
    {
      workspaceId: wsId, projectId: projWebsite._id, sectionId: wSec3._id,
      title: "Cross-browser testing", status: "TODO", priority: "MEDIUM",
      assigneeIds: [admin._id], labelIds: [lFrontend._id],
      startDate: d(20), dueDate: d(28),
      createdBy: admin._id, position: 0,
    },
    {
      workspaceId: wsId, projectId: projWebsite._id, sectionId: wSec3._id,
      title: "Performance audit (Core Web Vitals)", status: "TODO", priority: "HIGH",
      assigneeIds: [engineer._id],
      startDate: d(22), dueDate: d(30),
      createdBy: admin._id, position: 1,
    },
  ]);

  // ─── Tasks: Mobile App ───────────────────────────────────────────────────
  const mobileTasks = await Task.insertMany([
    {
      workspaceId: wsId, projectId: projMobile._id, sectionId: mSec1._id,
      title: "Design onboarding flow (5 screens)", status: "DONE", priority: "URGENT",
      assigneeIds: [designer._id], labelIds: [lDesign._id],
      startDate: d(-30), dueDate: d(-20),
      createdBy: admin._id, position: 0,
    },
    {
      workspaceId: wsId, projectId: projMobile._id, sectionId: mSec1._id,
      title: "Auth service — JWT + refresh tokens", status: "IN_PROGRESS", priority: "URGENT",
      assigneeIds: [engineer._id], labelIds: [lBackend._id],
      startDate: d(-10), dueDate: d(3),
      createdBy: admin._id, position: 1,
    },
    {
      workspaceId: wsId, projectId: projMobile._id, sectionId: mSec1._id,
      title: "Push notification setup (FCM)", status: "TODO", priority: "HIGH",
      assigneeIds: [engineer._id], labelIds: [lBackend._id],
      startDate: d(5), dueDate: d(14),
      createdBy: admin._id, position: 2,
    },
    {
      workspaceId: wsId, projectId: projMobile._id, sectionId: mSec2._id,
      title: "Dashboard screen implementation", status: "TODO", priority: "HIGH",
      assigneeIds: [engineer._id, designer._id], labelIds: [lFrontend._id],
      startDate: d(8), dueDate: d(18),
      createdBy: admin._id, position: 0,
    },
    {
      workspaceId: wsId, projectId: projMobile._id, sectionId: mSec2._id,
      title: "Fix: crash on deep link navigation", status: "TODO", priority: "URGENT",
      assigneeIds: [engineer._id], labelIds: [lBug._id],
      startDate: d(-2), dueDate: d(1),
      createdBy: admin._id, position: 1,
    },
    {
      workspaceId: wsId, projectId: projMobile._id, sectionId: mSec2._id,
      title: "App store submission prep (screenshots, copy)", status: "TODO", priority: "MEDIUM",
      assigneeIds: [designer._id, admin._id],
      startDate: d(20), dueDate: d(30),
      createdBy: admin._id, position: 2,
    },
  ]);

  // ─── Tasks: Marketing ────────────────────────────────────────────────────
  const marketingTasks = await Task.insertMany([
    {
      workspaceId: wsId, projectId: projMarketing._id, sectionId: mkSec1._id,
      title: "Q3 content calendar", status: "ON_HOLD", priority: "MEDIUM",
      assigneeIds: [admin._id],
      startDate: d(10), dueDate: d(25),
      createdBy: admin._id, position: 0,
    },
    {
      workspaceId: wsId, projectId: projMarketing._id, sectionId: mkSec1._id,
      title: "Launch email sequence (5-email drip)", status: "TODO", priority: "HIGH",
      assigneeIds: [admin._id, guest._id],
      startDate: d(15), dueDate: d(28),
      createdBy: admin._id, position: 1,
    },
  ] as Parameters<typeof Task.insertMany>[0]);

  console.log(`✓ Created ${websiteTasks.length + mobileTasks.length + marketingTasks.length} tasks`);

  // ─── Task Dependencies (to show Timeline arrows) ──────────────────────────
  // "Component library" blocks "Header component"
  const compLibTask = websiteTasks[1]; // component library
  const headerTask = websiteTasks[4]; // header component
  // "Auth service" blocks "Dashboard"
  const authTask = mobileTasks[1];
  const dashboardTask = mobileTasks[3];
  // "Auth service" blocks "Push notifications"
  const pushTask = mobileTasks[2];
  // "Design onboarding" blocks "Dashboard"
  const onboardingTask = mobileTasks[0];

  await TaskDependency.insertMany([
    {
      workspaceId: wsId,
      fromTaskId: headerTask._id,
      toTaskId: compLibTask._id,
      type: "BLOCKS",
      createdBy: admin._id,
    },
    {
      workspaceId: wsId,
      fromTaskId: dashboardTask._id,
      toTaskId: authTask._id,
      type: "BLOCKS",
      createdBy: admin._id,
    },
    {
      workspaceId: wsId,
      fromTaskId: pushTask._id,
      toTaskId: authTask._id,
      type: "BLOCKS",
      createdBy: admin._id,
    },
    {
      workspaceId: wsId,
      fromTaskId: dashboardTask._id,
      toTaskId: onboardingTask._id,
      type: "BLOCKS",
      createdBy: admin._id,
    },
  ]);
  console.log("✓ Created 4 task dependencies");

  // ─── Custom Field: Story Points on Mobile App ────────────────────────────
  const spField = await CustomField.create({
    workspaceId: wsId,
    projectId: projMobile._id,
    name: "Story Points",
    type: "NUMBER",
    options: [],
    position: 0,
    createdBy: admin._id,
  });

  await TaskFieldValue.insertMany([
    { workspaceId: wsId, taskId: mobileTasks[1]._id, fieldId: spField._id, value: 8 },
    { workspaceId: wsId, taskId: mobileTasks[2]._id, fieldId: spField._id, value: 5 },
    { workspaceId: wsId, taskId: mobileTasks[3]._id, fieldId: spField._id, value: 13 },
    { workspaceId: wsId, taskId: mobileTasks[4]._id, fieldId: spField._id, value: 3 },
  ]);
  console.log("✓ Created custom field: Story Points");

  // ─── Sample Comments ──────────────────────────────────────────────────────
  await Comment.insertMany([
    {
      workspaceId: wsId,
      taskId: mobileTasks[1]._id,
      authorId: engineer._id,
      body: "<p>Started on the JWT implementation. Should have refresh token rotation working by EOD.</p>",
      parentId: null,
    },
    {
      workspaceId: wsId,
      taskId: mobileTasks[1]._id,
      authorId: admin._id,
      body: "<p>@Jordan — remember to add rate limiting on the token refresh endpoint. We got burned by this before.</p>",
      parentId: null,
    },
    {
      workspaceId: wsId,
      taskId: websiteTasks[4]._id,
      authorId: designer._id,
      body: "<p>Header designs are finalized in Figma. Mobile breakpoints included. Linking the frame here: <a href='#'>Figma link</a></p>",
      parentId: null,
    },
  ] as Parameters<typeof Comment.insertMany>[0]);
  console.log("✓ Created 3 sample comments");

  await mongoose.disconnect();

  console.log("\n✅ Demo seed complete!");
  console.log("\nLogin credentials (all use password: Demo1234!):");
  console.log("  Admin:    alex@demo.acme");
  console.log("  Designer: sam@demo.acme");
  console.log("  Engineer: jordan@demo.acme");
  console.log("  Guest:    casey@demo.acme");
  console.log("\nWorkspace slug: acme-corp");
  console.log("  → http://localhost:3000/w/acme-corp");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
