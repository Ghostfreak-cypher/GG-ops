import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import {
  claimMessage,
  ensureLabel,
  gmailClient,
  getMessage,
  isGmailConfigured,
  listUnprocessed,
  markFailed,
  FAILED_LABEL,
  PROCESSED_LABEL,
} from "@/lib/gmail";
import { parseGmailMessage } from "@/modules/inbound-email/normalize";
import { resolveSender, resolveTarget, verifyAuthResults } from "@/modules/inbound-email/verify";
import { extractTask, isExtractionConfigured } from "@/modules/inbound-email/extract";
import { createTaskForActor } from "@/modules/task/server/create-task-core";
import { stripMentions } from "@/modules/task/server/strip-mentions";

/** Bounded per run: this work happens inline on the cron request. */
const MAX_MESSAGES_PER_RUN = 10;
/** Per-sender ceiling, so one member (or one compromised account) can't flood a board. */
const SENDER_HOURLY_LIMIT = 20;

export type IngestVerdict =
  | "created"
  | "unverified_sender"
  | "unknown_sender"
  | "no_target"
  | "not_a_task"
  | "rate_limited"
  | "rejected"
  | "error";

export type IngestSummary = {
  enabled: boolean;
  scanned: number;
  created: number;
  skipped: number;
  failed: number;
  details: { messageId: string; verdict: IngestVerdict; note?: string }[];
};

/**
 * Poll Gmail, turn qualifying mail into tasks, and report what happened to each message.
 *
 * The LLM call runs INLINE rather than through `enqueue()`. The queue dispatches
 * synchronously anyway, so routing through it would defer nothing — and its 5-attempt
 * retry would re-run the extraction and create duplicate tasks on any post-create failure.
 * A task-creating job is not safely retryable.
 */
export async function ingestInboundEmail(): Promise<IngestSummary> {
  const summary: IngestSummary = {
    enabled: false,
    scanned: 0,
    created: 0,
    skipped: 0,
    failed: 0,
    details: [],
  };

  // Kill switch first: this must stay off unless someone deliberately turned it on.
  if (env.INBOUND_EMAIL_ENABLED !== "true") return summary;
  if (!isGmailConfigured() || !isExtractionConfigured()) {
    logger.warn("inbound-email enabled but not fully configured", {
      gmail: isGmailConfigured(),
      extraction: isExtractionConfigured(),
    });
    return summary;
  }
  summary.enabled = true;

  const gmail = gmailClient();
  const [processedLabelId, failedLabelId] = await Promise.all([
    ensureLabel(gmail, PROCESSED_LABEL),
    ensureLabel(gmail, FAILED_LABEL),
  ]);

  const ids = await listUnprocessed(gmail, MAX_MESSAGES_PER_RUN);
  summary.scanned = ids.length;

  for (const id of ids) {
    let verdict: IngestVerdict = "error";
    let note: string | undefined;

    try {
      const email = parseGmailMessage(await getMessage(gmail, id));

      // Claim BEFORE any expensive or side-effecting work, so two overlapping cron runs
      // cannot both process this message. Costs us at-most-once delivery; a duplicate task
      // would be worse than a dropped email, and `ggops-failed` keeps drops visible.
      await claimMessage(gmail, id, processedLabelId);

      // Gate 1 — is the sender who they say they are?
      const auth = verifyAuthResults(email.authResults);
      if (!auth.ok) {
        verdict = "unverified_sender";
        note = auth.reason;
      } else {
        // Gate 2 — do we know them?
        const sender = await resolveSender(email);
        if (!sender.ok) {
          verdict = "unknown_sender";
          note = sender.reason;
        } else {
          const limited = await rateLimit(
            `inbound:${email.fromEmail}`,
            SENDER_HOURLY_LIMIT,
            3600,
          );
          if (!limited.allowed) {
            verdict = "rate_limited";
            note = `Over ${SENDER_HOURLY_LIMIT} emails/hour.`;
          } else {
            // Gate 3 — which project, and may they write to it?
            const target = await resolveTarget(email, sender.actor);
            if (!target.ok) {
              verdict = "no_target";
              note = target.reason;
            } else {
              // Only now is it worth spending a token.
              const extracted = await extractTask(email);
              if (!extracted) {
                verdict = "not_a_task";
              } else {
                const result = await createTaskForActor(sender.actor, target.projectId, {
                  title: extracted.title,
                  description: extracted.description
                    ? stripMentions(extracted.description)
                    : undefined,
                  priority: extracted.priority,
                  dueDate: extracted.dueDate,
                });

                if (result.ok) {
                  verdict = "created";
                  note = `${target.workspaceName} / ${target.projectName}`;
                  summary.created += 1;
                } else {
                  // Gate 4: createTaskForActor re-runs getProjectForUser + canEditTasks, so
                  // a sender who lost access between resolution and write is caught here.
                  verdict = "rejected";
                  note = result.error;
                }
              }
            }
          }
        }
      }
    } catch (error) {
      verdict = "error";
      note = error instanceof Error ? error.message : String(error);
      logger.error("inbound-email ingest failed", { messageId: id, error: note });
    }

    if (verdict !== "created") {
      summary.failed += verdict === "error" ? 1 : 0;
      summary.skipped += verdict === "error" ? 0 : 1;
      // Label non-successes so a human can see what was dropped and why.
      await markFailed(gmail, id, failedLabelId).catch(() => undefined);
    }

    summary.details.push({ messageId: id, verdict, ...(note ? { note } : {}) });
    logger.info("inbound-email processed", { messageId: id, verdict, note });
  }

  return summary;
}
