/**
 * Maintenance backfill: marks every account still sitting in the "unverified"
 * state as email-verified.
 *
 * Usage (from my-app/):
 *   npm run db:verify-users          # preview only — lists who would change, writes nothing
 *   npm run db:verify-users:apply    # actually writes
 *
 * The gate is deliberately fail-safe: writing requires an explicit `--apply`, and
 * that flag is baked into its own npm script rather than passed with `npm run … --`.
 * npm silently swallows args that collide with its own CLI flags (`--dry-run` is one
 * of them), so a preview flag passed that way can go missing and the script would
 * write when you asked it not to. Defaulting to preview makes a lost flag harmless.
 *
 * Why `$type: "null"` and not `emailVerifiedAt: null`:
 * the DAL (src/modules/auth/server/session.ts) treats the field as tri-state —
 * missing means verified (legacy accounts), an explicit `null` means NOT verified,
 * a Date means verified. In MongoDB a plain `{ field: null }` filter also matches
 * documents where the field is absent, which would needlessly rewrite the legacy
 * accounts. `$type: "null"` matches only the explicit nulls — exactly the accounts
 * that render the "Verify your email" banner.
 *
 * Idempotent: a second run matches nothing.
 */
try {
  (process as unknown as { loadEnvFile?: (p: string) => void }).loadEnvFile?.(".env.local");
} catch {
  /* env may already be set in the shell */
}

import mongoose from "mongoose";
import { User } from "@/models/User";

const MONGODB_URI = process.env.MONGODB_URI;
const apply = process.argv.includes("--apply");

/** Only the explicitly-null accounts — see the note above. */
const UNVERIFIED_FILTER = { emailVerifiedAt: { $type: "null" } } as const;

async function main() {
  if (!MONGODB_URI || MONGODB_URI.includes("placeholder")) {
    console.error("Set a real MONGODB_URI in my-app/.env.local (or your shell) before running.");
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);

  const pending = await User.find(UNVERIFIED_FILTER).select("name email").lean();

  if (pending.length === 0) {
    console.log("No unverified accounts found — nothing to do.");
    await mongoose.disconnect();
    return;
  }

  console.log(`${pending.length} unverified account(s):`);
  for (const user of pending) {
    console.log(`  - ${user.name} <${user.email}>`);
  }

  if (!apply) {
    console.log("\nPreview only — no changes written. Run `npm run db:verify-users:apply` to write.");
    await mongoose.disconnect();
    return;
  }

  const result = await User.updateMany(UNVERIFIED_FILTER, {
    $set: { emailVerifiedAt: new Date() },
  });

  console.log(`\nmatched: ${result.matchedCount}, modified: ${result.modifiedCount}`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
