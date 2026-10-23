import { env } from "@/lib/env";

export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const base = env.APP_URL ?? "http://localhost:3000";
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return new URL(path, base).toString();
}

/**
 * Our OAuth issuer identifier — origin with no trailing slash.
 *
 * Every place that publishes or asserts the issuer must use this one function:
 * RFC 8414 §2 and RFC 9207 §2.4 compare it by exact string match, so a lone
 * trailing slash (`absoluteUrl("/")` returns one) is a hard mismatch and clients
 * abort the authorization.
 */
export function issuerUrl(): string {
  return absoluteUrl("/").replace(/\/$/, "");
}