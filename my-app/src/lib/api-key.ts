import { createHash, randomBytes } from "node:crypto";

const TOKEN_PREFIX = "ggops_sk_";
const DISPLAY_PREFIX_LENGTH = TOKEN_PREFIX.length + 6;

/**
 * OAuth-issued access tokens are short-lived (refreshed via the long-lived refresh
 * token on the OAuthGrant). Exported so the token response's `expires_in` and the
 * `ApiKey.expiresAt` written to the database can never drift apart.
 */
export const OAUTH_ACCESS_TOKEN_TTL_SECONDS = 60 * 60;

/**
 * SHA-256, not bcrypt: the token carries 256 bits of entropy so there is nothing to
 * key-stretch, and this runs on every agent request. The unique index on `tokenHash`
 * means lookup is by exact hash, so there is no secret-dependent comparison to time.
 */
export function hashApiKey(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Mint a key. The plaintext is returned once, shown once, and never stored. */
export function mintApiKey() {
  const token = TOKEN_PREFIX + randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: hashApiKey(token),
    prefix: token.slice(0, DISPLAY_PREFIX_LENGTH),
  };
}

/** Pull a GGOps key out of an `Authorization` header. Returns null for anything else. */
export function parseBearerApiKey(header: string | null | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer") return null;
  if (!token?.startsWith(TOKEN_PREFIX)) return null;
  return token;
}
