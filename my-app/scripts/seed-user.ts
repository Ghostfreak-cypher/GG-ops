/**
 * Dev seed: upserts one test user so the Credentials sign-in path is testable
 * before Phase 1 builds real sign-up. Run with: npm run db:seed
 */
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// Load .env.local if the runtime supports it (Node >= 20.12). Safe to ignore otherwise.
try {
  (process as unknown as { loadEnvFile?: (p: string) => void }).loadEnvFile?.(".env.local");
} catch {
  /* env may already be set in the shell */
}

const MONGODB_URI = process.env.MONGODB_URI;
const email = (process.env.SEED_EMAIL ?? "test@example.com").toLowerCase();
const password = process.env.SEED_PASSWORD ?? "password123";

async function main() {
  if (!MONGODB_URI || MONGODB_URI.includes("placeholder")) {
    console.error(
      "Set a real MONGODB_URI in my-app/.env.local (or your shell) before seeding.",
    );
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  const passwordHash = await bcrypt.hash(password, 10);

  await mongoose.connection.collection("users").updateOne(
    { email },
    {
      $set: { name: "Test User", passwordHash, isActive: true, updatedAt: new Date() },
      $setOnInsert: { email, createdAt: new Date() },
    },
    { upsert: true },
  );

  console.log(`Seeded user:  ${email}  /  ${password}`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
