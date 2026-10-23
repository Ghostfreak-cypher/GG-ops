import { handle } from "@/lib/api/handler";
import { err } from "@/lib/api/response";
import { rateLimit } from "@/lib/rate-limit";
import { absoluteUrl } from "@/lib/urls";
import { getCurrentUser, type AuthedUser } from "@/modules/auth/server/session";

/** Matches `API_KEY_HOURLY_LIMIT` in `lib/api/handler.ts`; agents share one budget. */
const API_KEY_HOURLY_LIMIT = 600;

/**
 * CORS for the MCP endpoint.
 *
 * `proxy.ts`'s matcher excludes all of `/api/**`, so nothing upstream adds these headers.
 * Claude Code calls server-side and doesn't care — but claude.ai's connector runs in the
 * browser and will fail without them, which makes this an easy bug to ship and never see
 * locally.
 *
 * `*` is deliberate and safe here: this endpoint authenticates from the `Authorization`
 * header, never a cookie, and we do NOT send `Access-Control-Allow-Credentials`. Browsers
 * reject `*` on credentialed requests, so a malicious page cannot ride a logged-in user's
 * session cookie into this route — it would have to already possess the bearer token.
 *
 * `Expose-Headers: WWW-Authenticate` is load-bearing: without it a browser client cannot
 * read the 401 challenge, and OAuth discovery silently never starts.
 */
export const MCP_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, mcp-protocol-version, accept",
  "Access-Control-Expose-Headers": "WWW-Authenticate, MCP-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};

function unauthorized(): Response {
  const resourceMetadata = absoluteUrl("/.well-known/oauth-protected-resource");
  return err("Unauthorized", 401, {
    ...MCP_CORS_HEADERS,
    "WWW-Authenticate": `Bearer realm="ggops", resource_metadata="${resourceMetadata}"`,
  });
}

/**
 * `handleAuthed`'s twin for a single-verb RPC endpoint.
 *
 * Identical principal resolution, identical 401 challenge, identical per-key rate limit.
 * The ONE deliberate divergence: it does not derive scope from the HTTP method. Every MCP
 * call is a `POST`, so `handleAuthed`'s `isWrite` heuristic would reject a read-only key
 * for `initialize` and `tools/list` — the endpoint would be unusable with exactly the
 * least-privileged key we most want people to use. Scope is declared per tool instead and
 * enforced in `protocol.ts` (filtered in `tools/list`, re-checked in `tools/call`).
 *
 * `transport.test.ts` pins that divergence so this doesn't get "de-duplicated" back into
 * `handleAuthed` by someone who notices the resemblance.
 *
 * Rate limiting stays uniform across every method, including metadata ones. Exempting
 * `initialize`/`ping`/`tools/list` would spare an agent's budget, but it would also mean
 * any holder of a valid key gets unmetered requests — and the body must be parsed to know
 * the method, so the exemption would have to happen after we've already done the work.
 */
export function handleMcp(
  fn: (req: Request, user: AuthedUser) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return handle(async (req: Request) => {
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    if (user.apiKeyId) {
      const limited = await rateLimit(`apikey:${user.apiKeyId}`, API_KEY_HOURLY_LIMIT, 3600, {
        failClosed: true,
      });
      if (!limited.allowed) return err("Too Many Requests", 429, MCP_CORS_HEADERS);
    }

    return fn(req, user);
  });
}
