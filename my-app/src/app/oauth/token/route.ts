import { rateLimit, clientIp } from "@/lib/rate-limit";
import { oauthError, respondOAuthResult } from "@/lib/oauth-response";
import { logger } from "@/lib/logger";
import { exchangeToken } from "@/modules/oauth/server/actions/exchange-token";

export async function POST(req: Request): Promise<Response> {
  const limited = await rateLimit(`oauth-token:${clientIp(req)}`, 60, 3600, { failClosed: true });
  if (!limited.allowed) return oauthError("invalid_request", "Too many requests.", 429);

  try {
    // Spec-mandated content type — not JSON, unlike the rest of this app.
    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return oauthError("invalid_request", "Expected an application/x-www-form-urlencoded body.");
    }
    const body = Object.fromEntries(formData.entries());
    const result = await exchangeToken(body);
    return respondOAuthResult(result);
  } catch (error) {
    logger.error("OAuth token exchange failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return oauthError("server_error", "Token exchange failed.", 500);
  }
}
