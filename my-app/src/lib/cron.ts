/**
 * Cron routes are public endpoints — protect them with a shared secret.
 * Set `CRON_SECRET` and have the scheduler send `Authorization: Bearer <secret>`.
 * With no secret set, requests are allowed (dev convenience).
 */
export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
