/**
 * Queues a demo invite-email job in MongoDB, then drains it immediately —
 * the same path the real /api/cron/jobs endpoint takes.
 *
 *   npm run db:seed          # ensure DB is up first
 *   npx tsx --env-file=.env.local scripts/send-cron-invite.ts
 */
import mongoose, { Schema, model, models, type Model, type InferSchemaType } from "mongoose";
import nodemailer from "nodemailer";

// ── 1. Load env ──────────────────────────────────────────────────────────────
try {
  (process as unknown as { loadEnvFile?: (p: string) => void }).loadEnvFile?.(".env.local");
} catch { /* already in shell */ }

const MONGODB_URI = process.env.MONGODB_URI ?? "";
const SMTP_HOST   = process.env.SMTP_HOST ?? "";
const SMTP_PORT   = parseInt(process.env.SMTP_PORT ?? "587", 10);
const SMTP_USER   = process.env.SMTP_USER ?? "";
const SMTP_PASS   = process.env.SMTP_PASS ?? "";
const EMAIL_FROM  = process.env.EMAIL_FROM ?? "";
const APP_URL     = process.env.APP_URL ?? "http://localhost:3000";

if (!MONGODB_URI || MONGODB_URI.includes("placeholder")) {
  console.error("Set a real MONGODB_URI in .env.local before running.");
  process.exit(1);
}
if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !EMAIL_FROM) {
  console.error("SMTP_HOST / SMTP_USER / SMTP_PASS / EMAIL_FROM are required.");
  process.exit(1);
}

// ── 2. Inline Job model (mirrors src/models/Job.ts) ──────────────────────────
const JOB_STATUSES = ["PENDING", "RUNNING", "DONE", "FAILED"] as const;
const jobSchema = new Schema(
  {
    name:        { type: String, required: true },
    payload:     { type: Schema.Types.Mixed, required: true },
    status:      { type: String, enum: [...JOB_STATUSES], default: "PENDING", required: true },
    attempts:    { type: Number, default: 0 },
    lastError:   { type: String, default: null },
    runAfter:    { type: Date, default: () => new Date() },
    lockedAt:    { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
type JobDoc = InferSchemaType<typeof jobSchema>;
const Job: Model<JobDoc> =
  (models.Job as Model<JobDoc>) || model<JobDoc>("Job", jobSchema);

// ── 3. SMTP transporter ───────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

// ── 4. Main ───────────────────────────────────────────────────────────────────
async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("✓ Connected to MongoDB");

  const to = "vanshgoel979@gmail.com";
  const inviteUrl = `${APP_URL}/invite/cron-demo-token-0001`;

  // Persist job (this is what inviteMemberAction does via enqueue())
  const job = await Job.create({
    name: "invite-email",
    payload: { email: to, workspaceName: "My Workspace", inviteUrl },
    status: "PENDING",
    runAfter: new Date(),
    attempts: 0,
  });
  console.log(`✓ Job persisted  id=${String(job._id)}  status=PENDING`);

  // Drain — mirrors drainJobs() in src/lib/queue.ts
  job.status = "RUNNING";
  job.lockedAt = new Date();
  job.attempts = 1;
  await job.save();

  try {
    const info = await transporter.sendMail({
      from: EMAIL_FROM,
      to,
      subject: "You're invited to My Workspace",
      text: [
        `You've been invited to join My Workspace.`,
        ``,
        `Accept your invite: ${inviteUrl}`,
      ].join("\n"),
    });

    job.status = "DONE";
    job.completedAt = new Date();
    job.lastError = null;
    await job.save();

    console.log(`✓ Email sent     messageId=${info.messageId}`);
    console.log(`  to:            ${to}`);
    console.log(`  inviteUrl:     ${inviteUrl}`);
    console.log(`✓ Job marked     status=DONE`);
  } catch (err) {
    job.status = "FAILED";
    job.lastError = err instanceof Error ? err.message : String(err);
    await job.save();
    console.error("✗ Email failed:", job.lastError);
  } finally {
    job.lockedAt = null;
    await job.save();
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
