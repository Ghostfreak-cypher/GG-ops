/**
 * Backfill the default workstreams into an existing workspace.
 * Run with: npm run db:seed-labels        (targets slug "demo")
 *           LABEL_WS_SLUG=acme npm run db:seed-labels
 * Idempotent: re-running won't create duplicates.
 */
import mongoose from "mongoose";
import { DEFAULT_WORKSTREAMS } from "../src/lib/label-colors";

// Load .env.local if the runtime supports it (Node >= 20.12).
try {
  (process as unknown as { loadEnvFile?: (p: string) => void }).loadEnvFile?.(".env.local");
} catch {
  /* env may already be set in the shell */
}

const MONGODB_URI = process.env.MONGODB_URI;
const slug = process.env.LABEL_WS_SLUG ?? "demo";

async function main() {
  if (!MONGODB_URI || MONGODB_URI.includes("placeholder")) {
    console.error("Set a real MONGODB_URI in my-app/.env.local before seeding.");
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db!;

  const workspace = await db.collection("workspaces").findOne({ slug });
  if (!workspace) {
    console.error(`No workspace with slug "${slug}".`);
    await mongoose.disconnect();
    process.exit(1);
  }

  let created = 0;
  for (const w of DEFAULT_WORKSTREAMS) {
    const res = await db.collection("labels").updateOne(
      { workspaceId: workspace._id, name: w.name },
      {
        $setOnInsert: {
          workspaceId: workspace._id,
          name: w.name,
          color: w.color,
          createdBy: workspace.ownerId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );
    if (res.upsertedCount) created += 1;
  }

  console.log(
    `Workspace "${slug}": ${created} workstream(s) created, ${DEFAULT_WORKSTREAMS.length - created} already present.`,
  );
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
