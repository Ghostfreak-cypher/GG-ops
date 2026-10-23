/**
 * OAuth endpoints (`/oauth/token`, `/oauth/register`) speak RFC 6749 §5.2's error
 * shape, not this app's usual `{ok,error}` envelope (`lib/api/response.ts`) — OAuth
 * client libraries parse `error`/`error_description` directly, so these routes don't
 * go through `handle()`/`ok()`/`err()`.
 */
export type OAuthErrorCode =
  | "invalid_request"
  | "invalid_client"
  | "invalid_grant"
  | "unauthorized_client"
  | "unsupported_grant_type"
  | "invalid_scope"
  | "invalid_client_metadata" // RFC 7591 (DCR) reuses this error vocabulary
  | "server_error";

export function oauthOk<T extends object>(data: T, status = 200): Response {
  return Response.json(data, { status });
}

export function oauthError(error: OAuthErrorCode, description?: string, status = 400): Response {
  return Response.json({ error, error_description: description }, { status });
}

/** Result shape for the pure business-logic layer — routes translate this to a Response. */
export type OAuthResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: OAuthErrorCode; description?: string; status?: number };

export function respondOAuthResult<T extends object>(result: OAuthResult<T>, okStatus = 200): Response {
  if (result.ok) return oauthOk(result.data, okStatus);
  return oauthError(result.error, result.description, result.status ?? 400);
}
