import NextAuth from "next-auth";
import { authConfig } from "@/modules/auth/auth.config";

// Edge-safe NextAuth instance (no Mongoose) for optimistic route protection.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth?.user;
  const { pathname } = req.nextUrl;

  // Auth pages: bounce signed-in users to the app.
  if (pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up")) {
    if (isLoggedIn) return Response.redirect(new URL("/", req.nextUrl));
    return;
  }

  // Invite acceptance handles its own auth (sends new users to sign-up, keeping the token).
  if (pathname.startsWith("/invite")) return;

  // OAuth endpoints handle their own security: /oauth/authorize redirects
  // unauthenticated visitors itself (preserving the query string, like /invite
  // above); /oauth/token, /oauth/register, and /oauth/revoke are unauthenticated
  // machine-to-machine JSON endpoints that must never receive an HTML redirect.
  // Discovery documents under /.well-known must live at the true origin root
  // (RFC 8615) so they can't be moved under the already-excluded /api/**.
  if (pathname.startsWith("/oauth/") || pathname.startsWith("/.well-known/")) return;

  // PWA assets must be fetchable with no session — the browser requests the manifest
  // and service worker with no credentials at all, and a logged-out visitor still
  // needs the icons to see an install prompt on /sign-in. Exact matches for files, a
  // prefix only for the /icons folder.
  if (
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname === "/offline.html" ||
    pathname === "/icon.png" ||
    pathname === "/apple-icon.png" ||
    pathname.startsWith("/icons/")
  ) {
    return;
  }

  // Everything else (matcher already excludes /api + static) requires a session.
  if (!isLoggedIn) {
    return Response.redirect(new URL("/sign-in", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
