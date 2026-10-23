# API, Auth & Security

Rules for route handlers, server actions, and authorization. Treat every entry point as hostile input.

## API funnel
- **All route handlers go through** `src/lib/api/handler.ts` (error→JSON catch, optional Zod body validation, optional `requireUser()` gate) and return via `src/lib/api/response.ts` in the `{ ok, data, error }` shape. Don't write ad-hoc `try/catch` + `Response.json` per route.
- Move/reorder logic lives **only** in the task service module — never duplicate drag-drop logic across routes.

## Authorization (defense in depth)
- **Verify ownership chains on every mutation**: user∈workspace, project∈workspace, section∈project. Load and check — never infer from the client.
- **Never trust client-sent `workspaceId`/`projectId`/`sectionId`.** Re-derive or re-verify server-side.
- **Workspace-scope every task query** (see `data-and-mongoose.md`).
- Permission helpers live in `src/modules/<domain>/server/permissions/` (`canCreateProject`, `canInviteMembers`, `canEditTask`, …). Roles: `OWNER` / `ADMIN` / `MEMBER` / `GUEST`.

## Auth (Auth.js v5)
- **Credentials + Google**, **JWT session strategy**, **no DB adapter**. Users are upserted into our Mongoose `users` collection in the `signIn`/`jwt` callbacks.
- Config is split: `src/modules/auth/auth.config.ts` (edge-safe: Google + callbacks, no Mongoose) and `src/lib/auth.ts` (adds Credentials `authorize` with `bcryptjs.compare`).
- **DAL pattern**: read the session via `getCurrentUser()` / `requireUser()` (`src/modules/auth/server/session.ts`), memoized with React `cache()`. Do authz **close to the data**, not in layouts (layouts don't re-render on navigation).
- Treat **Server Actions and Route Handlers as public-facing endpoints** — every one re-checks auth + permissions, regardless of any client-side gating.
- `proxy.ts` does **optimistic** redirects only (cookie/JWT presence) — never DB lookups there.

## Secrets & data exposure
- Secrets only from validated `src/lib/env.ts`; never hardcode. `.env*` is gitignored.
- Return DTOs, not whole Mongo documents — never leak `passwordHash` or internal fields to the client.
