/**
 * Builds every declared Mongoose index against the real database, and drops any index that's
 * no longer declared in code. Run this once per deploy now that `connectDB` sets
 * `autoIndex: false` in production (src/lib/db.ts) — that flag stops indexes being verified
 * on every cold start, so building them is this script's job instead.
 *
 * Usage (from my-app/): npm run db:sync-indexes
 */
try {
  (process as unknown as { loadEnvFile?: (p: string) => void }).loadEnvFile?.(".env.local");
} catch {
  /* env may already be set in the shell */
}

import mongoose from "mongoose";
import { readdirSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  if (!MONGODB_URI || MONGODB_URI.includes("placeholder")) {
    console.error("Set a real MONGODB_URI in my-app/.env.local (or your shell) before syncing indexes.");
    process.exit(1);
  }

  // Import every model file so each one calls `model(...)` and registers its schema's
  // indexes on the shared mongoose instance — nothing else in this script references them
  // by name, so a plain side-effecting import is the whole job.
  const modelsDir = join(__dirname, "..", "src", "models");
  for (const file of readdirSync(modelsDir)) {
    if (file.endsWith(".ts") && !file.endsWith(".test.ts")) {
      await import(pathToFileURL(join(modelsDir, file)).href);
    }
  }

  await mongoose.connect(MONGODB_URI);

  const modelNames = mongoose.modelNames();
  console.log(`Syncing indexes for ${modelNames.length} model(s)...`);
  for (const name of modelNames) {
    const result = await mongoose.model(name).syncIndexes();
    if (result.length > 0) {
      console.log(`  ${name}: dropped/rebuilt ${result.join(", ")}`);
    }
  }

  console.log("Done.");
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
