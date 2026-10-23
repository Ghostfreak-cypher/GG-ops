/**
 * Import/upsert tasks from a MongoDB Extended JSON export.
 *
 * Usage (from my-app/):
 *   npm run db:seed-tasks -- ./tasks.json
 *   npx tsx scripts/seed-tasks.ts ./tasks.json
 *
 * The JSON file must be an array of task documents in Extended JSON format
 * (i.e., { "$oid": "..." } for ObjectIds, { "$date": "..." } for dates).
 * Idempotent: re-running with the same file upserts by _id without duplicating.
 */
try {
  (process as unknown as { loadEnvFile?: (p: string) => void }).loadEnvFile?.(".env.local");
} catch {
  /* env may already be set in the shell */
}

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import mongoose, { Types } from "mongoose";
import { Task } from "@/models/Task";
import { isValidObjectId } from "@/lib/mongo/ids";
import { TASK_STATUSES, TASK_PRIORITIES } from "@/modules/task/constants";
import type { TaskStatus, TaskPriority } from "@/modules/task/constants";

// ---------------------------------------------------------------------------
// Extended JSON deserializer
// ---------------------------------------------------------------------------

type RawDoc = Record<string, unknown>;

function isOidWrapper(v: unknown): v is { $oid: string } {
  return (
    typeof v === "object" &&
    v !== null &&
    "$oid" in v &&
    typeof (v as Record<string, unknown>)["$oid"] === "string"
  );
}

function isDateWrapper(v: unknown): v is { $date: string } {
  return (
    typeof v === "object" &&
    v !== null &&
    "$date" in v &&
    typeof (v as Record<string, unknown>)["$date"] === "string"
  );
}

function convertValue(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (isOidWrapper(v)) {
    if (!isValidObjectId(v.$oid)) throw new Error(`Invalid $oid: "${v.$oid}"`);
    return new Types.ObjectId(v.$oid);
  }
  if (isDateWrapper(v)) return new Date(v.$date);
  if (Array.isArray(v)) return v.map(convertValue);
  return v;
}

function convertDoc(raw: RawDoc): RawDoc {
  const out: RawDoc = {};
  for (const [key, val] of Object.entries(raw)) {
    out[key] = convertValue(val);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Validator — checks the fields the Task schema marks required
// ---------------------------------------------------------------------------

type ValidatedDoc = RawDoc & {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  projectId: Types.ObjectId;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdBy: Types.ObjectId;
};

function validateDoc(doc: RawDoc, index: number): ValidatedDoc {
  const { _id, workspaceId, projectId, title, status, priority, createdBy } = doc;
  if (!(_id instanceof Types.ObjectId)) throw new Error(`[${index}] _id must be an ObjectId`);
  if (!(workspaceId instanceof Types.ObjectId))
    throw new Error(`[${index}] missing or invalid workspaceId`);
  if (!(projectId instanceof Types.ObjectId))
    throw new Error(`[${index}] missing or invalid projectId`);
  if (typeof title !== "string" || title.trim() === "")
    throw new Error(`[${index}] missing title`);
  if (!TASK_STATUSES.includes(status as TaskStatus))
    throw new Error(`[${index}] invalid status: "${String(status)}"`);
  if (!TASK_PRIORITIES.includes(priority as TaskPriority))
    throw new Error(`[${index}] invalid priority: "${String(priority)}"`);
  if (!(createdBy instanceof Types.ObjectId))
    throw new Error(`[${index}] missing or invalid createdBy`);
  return doc as ValidatedDoc;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: tsx scripts/seed-tasks.ts <path-to-tasks.json>");
    process.exit(1);
  }

  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI || MONGODB_URI.includes("placeholder")) {
    console.error("Set a real MONGODB_URI in my-app/.env.local before seeding.");
    process.exit(1);
  }

  let rawParsed: unknown;
  try {
    rawParsed = JSON.parse(readFileSync(resolve(filePath), "utf-8"));
  } catch (err) {
    console.error(`Failed to read/parse "${filePath}":`, (err as Error).message);
    process.exit(1);
  }

  if (!Array.isArray(rawParsed)) {
    console.error("Expected a JSON array at the top level (wrap single objects in [ ]).");
    process.exit(1);
  }

  let skipped = 0;
  const operations: Parameters<typeof Task.bulkWrite>[0] = [];

  for (let i = 0; i < rawParsed.length; i++) {
    const item = rawParsed[i];
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      console.warn(`[${i}] Skipping non-object entry`);
      skipped++;
      continue;
    }
    try {
      const converted = convertDoc(item as RawDoc);
      const doc = validateDoc(converted, i);
      operations.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: doc },
          upsert: true,
        },
      });
    } catch (err) {
      console.warn(`${(err as Error).message} — skipping`);
      skipped++;
    }
  }

  if (operations.length === 0) {
    console.log(`No valid documents to upsert (${skipped} skipped).`);
    process.exit(0);
  }

  await mongoose.connect(MONGODB_URI);

  const result = await Task.bulkWrite(operations, { ordered: false });

  const writeErrors =
    (result as unknown as { writeErrors?: unknown[] }).writeErrors?.length ?? 0;

  console.log(
    `Seeded tasks: ${result.upsertedCount} inserted, ` +
      `${result.modifiedCount} updated, ` +
      `${skipped} validation-skipped, ` +
      `${writeErrors} write-error(s)`,
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
