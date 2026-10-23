import { rateLimit, clientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { revokeByPresentedToken } from "@/modules/oauth/server/actions/revoke-grant";

/**
 * RFC 7009. Always responds 200 regardless of whether anything matched — never
 * reveals whether a given token was valid, so this can't be used to probe tokens.
 */
export async function POST(req: Request): Promise<Response> {
  const limited = await rateLimit(`oauth-revoke:${clientIp(req)}`, 60, 3600, { failClosed: true });
  if (!limited.allowed) return new Response(null, { status: 429 });

  try {
    const formData = await req.formData().catch(() => null);
    const token = formData?.get("token");
    if (typeof token === "string" && token.length > 0) {
      await revokeByPresentedToken(token);
    }
  } catch (error) {
    logger.error("OAuth token revocation failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return new Response(null, { status: 200 });
}
