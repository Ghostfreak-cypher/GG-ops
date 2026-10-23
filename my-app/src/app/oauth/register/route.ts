import { rateLimit, clientIp } from "@/lib/rate-limit";
import { oauthError, respondOAuthResult } from "@/lib/oauth-response";
import { logger } from "@/lib/logger";
import { registerClient } from "@/modules/oauth/server/actions/register-client";

export async function POST(req: Request): Promise<Response> {
  const limited = await rateLimit(`oauth-register:${clientIp(req)}`, 20, 3600, { failClosed: true });
  if (!limited.allowed) return oauthError("invalid_request", "Too many registration attempts.", 429);

  try {
    const body = await req.json().catch(() => null);
    const result = await registerClient(body);
    return respondOAuthResult(result, 201);
  } catch (error) {
    logger.error("OAuth client registration failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return oauthError("server_error", "Registration failed.", 500);
  }
}
