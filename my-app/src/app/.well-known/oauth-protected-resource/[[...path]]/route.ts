import { issuerUrl } from "@/lib/urls";

/** The one resource this metadata describes. */
const RESOURCE_PATH = "api/mcp";

/**
 * RFC 9728 protected-resource metadata. Static — no DB access, so no rate limiting needed.
 *
 * Served at BOTH `/.well-known/oauth-protected-resource` and RFC 9728 §3.1's path-inserted
 * form `/.well-known/oauth-protected-resource/api/mcp`, because clients disagree about
 * which to fetch. Claude follows the absolute `resource_metadata` URL in our 401 challenge,
 * which is the bare path. Codex ignores that hint and probes well-known paths on the
 * resource origin instead (openai/codex#42427) — a 404 there silently aborts OAuth
 * discovery, and the client falls back to registering against the wrong place.
 *
 * An optional catch-all is how one handler covers both; it cannot coexist with a static
 * `route.ts` in this segment, which is why there is no longer one.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ path?: string[] }> },
): Promise<Response> {
  const { path } = await ctx.params;
  // Without this, every /.well-known/oauth-protected-resource/<anything> would answer 200
  // and claim /api/mcp as its resource.
  if (path && path.join("/") !== RESOURCE_PATH) return new Response(null, { status: 404 });

  const issuer = issuerUrl();
  return Response.json({
    resource: `${issuer}/${RESOURCE_PATH}`,
    authorization_servers: [issuer],
    scopes_supported: ["read", "write"],
    bearer_methods_supported: ["header"],
  });
}
