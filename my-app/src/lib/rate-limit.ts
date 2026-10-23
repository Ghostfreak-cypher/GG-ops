import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfter: number };

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip") || "unknown";
}

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  options: { failClosed?: boolean } = {},
): Promise<RateLimitResult> {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return { allowed: true };
  }

  const redisKey = `rate:${key}`;
  try {
    const url = env.UPSTASH_REDIS_REST_URL.replace(/\/$/, "");
    const headers = { Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}` };
    const incr = await fetch(`${url}/incr/${encodeURIComponent(redisKey)}`, { headers, cache: "no-store" });
    if (!incr.ok) throw new Error(`Upstash INCR failed: ${incr.status}`);
    const body = (await incr.json()) as { result?: number };
    const count = Number(body.result ?? 0);

    if (count === 1) {
      await fetch(`${url}/expire/${encodeURIComponent(redisKey)}/${windowSeconds}`, {
        headers,
        cache: "no-store",
      });
    }

    if (count > limit) return { allowed: false, retryAfter: windowSeconds };
    return { allowed: true };
  } catch (error) {
    // Default is fail-open: a Redis blip must not take down sign-up or uploads for humans.
    // Callers that are the *only* brake on an endpoint (the agent API) pass failClosed.
    logger.warn(options.failClosed ? "rateLimit failed closed" : "rateLimit failed open", {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return options.failClosed ? { allowed: false, retryAfter: windowSeconds } : { allowed: true };
  }
}