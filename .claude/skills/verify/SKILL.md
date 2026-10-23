---
name: verify
description: How to run and drive this app to verify changes at runtime (dev server, curl-based auth login flow, DB inspection).
---

# Verifying changes in this repo

## Launch

- `npm run dev` from `my-app/` serves on **:3000**. The user's own dev server is often already running there (a second instance exits with "Another next dev server is already running" after briefly binding :3001). If :3000 answers, just drive it — Turbopack HMR picks up source edits on the next request, no restart needed.
- `npm run build` fails locally at env validation (prod-only PUSHER/UPSTASH/SENTRY vars). Use `npx tsc --noEmit` + `npm run lint` as the static green signal; runtime verification goes through the dev server.

## Drive an authenticated flow with curl (Auth.js v5, JWT sessions)

```bash
# 1. CSRF token + cookie jar
CSRF=$(curl -s -c jar.txt http://localhost:3000/api/auth/csrf | sed -E 's/.*"csrfToken":"([^"]+)".*/\1/')

# 2. Credentials login (302 + authjs.session-token cookie on success;
#    redirect to /sign-in?error=CredentialsSignin on bad password)
curl -s -b jar.txt -c jar.txt -X POST http://localhost:3000/api/auth/callback/credentials \
  --data-urlencode "csrfToken=$CSRF" \
  --data-urlencode "email=..." --data-urlencode "password=..."

# 3. Inspect the session the server computes
curl -s -b jar.txt http://localhost:3000/api/auth/session

# 4. Hit a protected page; a dead/invalid session 307s to /sign-in?reason=session-expired
curl -s -b jar.txt -L -w "%{url_effective}\n" http://localhost:3000/
```

`/` redirects a signed-in user to their workspace (`/w/<slug>`). Delete the cookie jar afterwards — it holds a live session token.

## Inspect MongoDB directly

Node ESM script using `mongoose` + `bcryptjs`; parse `MONGODB_URI` from `my-app/.env.local`. **Module resolution follows the script's location**, so copy the script into `my-app/` (e.g. `my-app/__tmp.mjs`), run it, delete it. Collections: `users`, `loginevents`, `authtokens`, etc. (lowercase pluralized).

## Gotchas

- The dev server talks to the real MongoDB Atlas database — logins record `loginevents` and may enqueue alert emails; keep DB mutations minimal and restore what you change.
- `getCurrentUser` (`my-app/src/modules/auth/server/session.ts`) invalidates sessions whose JWT `authVersion` doesn't match the user doc — bumping `users.authVersion` is the way to test session revocation.
