/**
 * Standalone SMTP smoke-test. Run from my-app/:
 *   npx tsx --env-file=.env.local scripts/test-email.ts
 */
import nodemailer from "nodemailer";
import { inviteEmail, mentionEmail } from "../src/lib/jobs/templates";

const host = process.env.SMTP_HOST;
const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const from = process.env.EMAIL_FROM;
const appUrl = process.env.APP_URL ?? "http://localhost:3000";

if (!host || !user || !pass || !from) {
  console.error("Missing SMTP_HOST / SMTP_USER / SMTP_PASS / EMAIL_FROM in environment.");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user, pass },
});

const to = "Vanshgoel979@gmail.com";
const inviteUrl = `${appUrl}/invite/demo-test-token-0000`;
const taskUrl = `${appUrl}/w/my-workspace/projects/demo-project/tasks/demo-task`;

async function main() {
  // --- Invite email ---
  const invite = inviteEmail({
    inviterName: "Matthew Dingess",
    workspaceName: "GGAI",
    inviteUrl,
    memberNames: [
      "Anushka Garg",
      "Navdeep Kumaregowda",
      "Faraz",
      "Matthew Dingess",
      "Vishvaksen Pendyala",
    ],
  });

  const info1 = await transporter.sendMail({
    from,
    to,
    subject: invite.subject,
    text: invite.text,
    html: invite.html,
  });
  console.log("✓ Invite email sent:", info1.messageId);

  // --- Mention email ---
  const mention = mentionEmail({
    by: "Anushka Garg",
    taskTitle: "Design the onboarding flow",
    taskUrl,
    preview: "@Vansh can you take a look at the wireframes when you get a chance?",
  });

  const info2 = await transporter.sendMail({
    from,
    to,
    subject: mention.subject,
    text: mention.text,
    html: mention.html,
  });
  console.log("✓ Mention email sent:", info2.messageId);

  console.log("  To:", to);
}

main().catch((err) => {
  console.error("✗ Failed:", err.message);
  process.exit(1);
});
