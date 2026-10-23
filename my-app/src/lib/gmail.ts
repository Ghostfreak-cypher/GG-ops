import { google, type gmail_v1 } from "googleapis";
import { env } from "@/lib/env";

/**
 * Gmail access for the inbound-email → task pipeline.
 *
 * Reuses the `google.auth.OAuth2` + refresh-token shape already proven in
 * `lib/upload.ts` (`uploadGoogleOAuth`), but with its own client id/secret: the Drive adapter and
 * this need different scopes, and a single credential granting both mailbox and Drive
 * access is a wider blast radius than either feature needs.
 *
 * Scope required: `https://www.googleapis.com/auth/gmail.modify`. `gmail.readonly` is not
 * enough — we label messages as we process them, and that labelling IS the dedupe store.
 */

export const PROCESSED_LABEL = "ggops-processed";
export const FAILED_LABEL = "ggops-failed";

export function isGmailConfigured(): boolean {
  return Boolean(env.GMAIL_CLIENT_ID && env.GMAIL_CLIENT_SECRET && env.GMAIL_REFRESH_TOKEN);
}

export function gmailClient(): gmail_v1.Gmail {
  if (!isGmailConfigured()) {
    throw new Error(
      "Gmail is not configured — set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN.",
    );
  }
  const auth = new google.auth.OAuth2(env.GMAIL_CLIENT_ID, env.GMAIL_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: env.GMAIL_REFRESH_TOKEN });
  return google.gmail({ version: "v1", auth });
}

/** Find or create a label, returning its id. Idempotent — safe to call every run. */
export async function ensureLabel(gmail: gmail_v1.Gmail, name: string): Promise<string> {
  const existing = await gmail.users.labels.list({ userId: "me" });
  const found = existing.data.labels?.find((l) => l.name === name);
  if (found?.id) return found.id;

  const created = await gmail.users.labels.create({
    userId: "me",
    requestBody: { name, labelListVisibility: "labelShow", messageListVisibility: "show" },
  });
  if (!created.data.id) throw new Error(`Could not create Gmail label "${name}".`);
  return created.data.id;
}

/**
 * Ids of unread inbox messages we have not already handled.
 *
 * Dedupe lives in Gmail itself rather than a new Mongo collection: the label survives
 * redeploys, needs no migration, and cannot drift out of sync with the mailbox the way a
 * separate "seen ids" table would.
 */
export async function listUnprocessed(gmail: gmail_v1.Gmail, limit: number): Promise<string[]> {
  const res = await gmail.users.messages.list({
    userId: "me",
    q: `in:inbox is:unread -label:${PROCESSED_LABEL} -label:${FAILED_LABEL}`,
    maxResults: limit,
  });
  return (res.data.messages ?? []).map((m) => m.id).filter((id): id is string => Boolean(id));
}

export async function getMessage(
  gmail: gmail_v1.Gmail,
  id: string,
): Promise<gmail_v1.Schema$Message> {
  const res = await gmail.users.messages.get({ userId: "me", id, format: "full" });
  return res.data;
}

/**
 * Mark a message handled.
 *
 * Called BEFORE the expensive work, not after: two overlapping cron runs would otherwise
 * both pick up the same message and create the task twice. The trade is at-most-once
 * delivery — a crash between claiming and creating silently drops that email — which is
 * the right way round, because a duplicate task is worse than a missed one. `markFailed`
 * exists so drops are visible in the mailbox rather than silent.
 */
export async function claimMessage(
  gmail: gmail_v1.Gmail,
  id: string,
  processedLabelId: string,
): Promise<void> {
  await gmail.users.messages.modify({
    userId: "me",
    id,
    requestBody: { addLabelIds: [processedLabelId], removeLabelIds: ["UNREAD"] },
  });
}

export async function markFailed(
  gmail: gmail_v1.Gmail,
  id: string,
  failedLabelId: string,
): Promise<void> {
  await gmail.users.messages.modify({
    userId: "me",
    id,
    requestBody: { addLabelIds: [failedLabelId] },
  });
}
