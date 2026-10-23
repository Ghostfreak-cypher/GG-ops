/**
 * The `?next=` target to send the user to after sign-in/sign-up — or "/" unless it stays on
 * `origin`. Resolved with the same URL parser the browser navigates with, so `//host`, `/\host`,
 * tab-smuggled `/\t/host` and `javascript:` URLs all fall back to "/".
 */
export function safeNextUrl(raw: string | null, origin: string): string {
  if (!raw) return "/";
  try {
    return new URL(raw, origin).origin === origin ? raw : "/";
  } catch {
    return "/";
  }
}

/** Client-only: the validated `?next=` of the current page. */
export function nextUrl(): string {
  if (typeof window === "undefined") return "/";
  return safeNextUrl(
    new URLSearchParams(window.location.search).get("next"),
    window.location.origin,
  );
}
