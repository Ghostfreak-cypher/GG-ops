import { timingSafeEqual } from "crypto";

/**
 * Cron routes are public endpoints — protect them with a shared secret.
 * Set `CRON_SECRET` and have the scheduler send `Authorization: Bearer <secret>`.
 * With no secret set, requests are allowed (dev convenience).
 */
export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  // Constant-time, so response timing can't reveal how much of the secret matched.
  return given.length === expected.length && timingSafeEqual(given, expected);
}
