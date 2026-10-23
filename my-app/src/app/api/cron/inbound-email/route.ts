import { handle } from "@/lib/api/handler";
import { ok, err } from "@/lib/api/response";
import { isCronAuthorized } from "@/lib/cron";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { ingestInboundEmail } from "@/modules/inbound-email/ingest";

/**
 * Poll Gmail and turn qualifying mail into tasks.
 *
 * Same shape as every other cron route (shared-secret gate, per-IP rate limit, one job
 * function, exported as both GET and POST). Returns `{enabled:false}` untouched when
 * INBOUND_EMAIL_ENABLED isn't "true", so scheduling it before the feature is configured
 * is harmless.
 */
async function run(req: Request) {
  if (!isCronAuthorized(req)) return err("Unauthorized", 401);
  const limited = await rateLimit(`cron:${clientIp(req)}:${new URL(req.url).pathname}`, 10, 3600);
  if (!limited.allowed) return err("Too Many Requests", 429);
  return ok(await ingestInboundEmail());
}

export const GET = handle(run);
export const POST = handle(run);
