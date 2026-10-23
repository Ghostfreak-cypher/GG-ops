/**
 * One-off seed: inserts a specific completed task into the demo workspace's
 * "Demo" project. Idempotent on the task's fixed _id.
 * Run with: npx tsx scripts/seed-demo-task.ts
 */
import mongoose from "mongoose";

try {
  (process as unknown as { loadEnvFile?: (p: string) => void }).loadEnvFile?.(".env.local");
} catch {
  /* env may already be set in the shell */
}

const MONGODB_URI = process.env.MONGODB_URI;

const oid = (id: string) => new mongoose.Types.ObjectId(id);

const task = {
  workspaceId: oid("6a4138f51146ac5ce08c1542"),
  projectId: oid("6a41390c1146ac5ce08c1544"),
  sectionId: null,
  parentTaskId: null,
  title: "3 atomicity/dedupe/gnomAD fixes",
  description:
    "All 3 fixes are complete and committed to v2-accelerated as of this session:\n\n" +
    "1. Atomic idempotency claim (dedupe fix)\n" +
    "- Replaced the non-atomic validate_job_for_async_start read-then-check guard with claim_job_for_processing() — a single MongoDB find_one_and_update that atomically transitions pending|failed → processing.\n" +
    "- Now rejects COMPLETED jobs too (was the exact prod miss that caused the cardiac job to re-run).\n" +
    "- processing_started_at is written exactly once, fixing the timestamp corruption.\n\n" +
    "2. gnomAD shared rate limiter\n" +
    "- New app/services/annotation/gnomad_throttle.py: cross-worker Redis INCR gnomad:out:{second} global budget + shared gnomad:backoff_until flag. One 429 pauses all 16 workers instead of each discovering it independently. Fail-open on Redis unavailability.\n" +
    "- AF cache write-back: successful gnomAD API responses now upsert into shared MongoDB gnomad_cache so subsequent workers get cache hits.\n\n" +
    "3. pydantic-core pin (test suite unblock)\n" +
    "- requirements.txt now pins pydantic-core==2.14.1 alongside pydantic==2.5.0 to prevent core/source version drift.\n\n" +
    "Commits:\n" +
    "- e76feae — fix(jobs): atomic idempotency claim + shared gnomAD limiter (11 files, +468/-33)\n" +
    "- 0319f16 — build(deps): pin pydantic-core==2.14.1 to match pydantic 2.5.0 (1 file)\n\n" +
    "Test suite: 46 passed, 0 failures.",
  status: "DONE",
  priority: "HIGH",
  type: "TASK",
  assigneeIds: [oid("6a4138a94f81183e11ea2bf5"), oid("6a42b37d2770399e6f6865ac")],
  labelIds: [oid("6a414c554f81183e11ea2d86")],
  dueDate: new Date("2026-06-20T00:00:00.000Z"),
  startDate: null,
  completedAt: new Date("2026-06-20T00:00:00.000Z"),
  createdBy: oid("6a42b37d2770399e6f6865ac"),
  updatedBy: oid("6a4138a94f81183e11ea2bf5"),
  isArchived: false,
  position: 1000,
  recurrenceRule: null,
  recurrenceParentId: null,
  createdAt: new Date("2026-06-20T00:00:00.000Z"),
  updatedAt: new Date("2026-06-20T00:00:00.000Z"),
  __v: 0,
};

async function main() {
  if (!MONGODB_URI || MONGODB_URI.includes("placeholder")) {
    console.error("Set a real MONGODB_URI in my-app/.env.local before seeding.");
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db!;

  const workspace = await db.collection("workspaces").findOne({ _id: task.workspaceId });
  if (!workspace) {
    console.error("Demo workspace not found — aborting.");
    await mongoose.disconnect();
    process.exit(1);
  }

  const res = await db.collection("tasks").updateOne(
    { workspaceId: task.workspaceId, projectId: task.projectId, title: task.title },
    { $setOnInsert: task },
    { upsert: true },
  );

  if (res.upsertedCount) {
    console.log(
      `Inserted task "${task.title}" (${res.upsertedId}) into workspace "${workspace.slug}".`,
    );
  } else {
    console.log(`Task "${task.title}" already exists in this project — no changes made.`);
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
