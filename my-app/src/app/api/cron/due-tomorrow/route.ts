import { handle } from "@/lib/api/handler";
import { ok, err } from "@/lib/api/response";
import { isCronAuthorized } from "@/lib/cron";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { generateDueTomorrowReminders } from "@/lib/jobs/scheduled";

async function run(req: Request) {
  if (!isCronAuthorized(req)) return err("Unauthorized", 401);
  const limited = await rateLimit(`cron:${clientIp(req)}:${new URL(req.url).pathname}`, 10, 3600);
  if (!limited.allowed) return err("Too Many Requests", 429);
  return ok(await generateDueTomorrowReminders());
}

export const GET = handle(run);
export const POST = handle(run);
