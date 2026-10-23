import { createHash } from "node:crypto";

/** RFC 7636 S256 shape: base64url(sha256(...)) is always exactly 43 characters. */
const S256_CHALLENGE_RE = /^[A-Za-z0-9_-]{43}$/;

export function isValidCodeChallenge(value: unknown): value is string {
  return typeof value === "string" && S256_CHALLENGE_RE.test(value);
}

/** OAuth 2.1 mandates PKCE with S256 for every client — no "plain" fallback. */
export function verifyPkce(codeVerifier: string, codeChallenge: string): boolean {
  const computed = createHash("sha256").update(codeVerifier).digest("base64url");
  return computed === codeChallenge;
}
