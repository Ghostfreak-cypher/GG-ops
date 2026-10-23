# Asana Clone

A company-grade, Asana-style project management platform (workspaces → projects → sections → tasks → comments → notifications). Built as a **Next.js-first modular monolith**.

> **The app lives in [`my-app/`](my-app/).** Run all `npm` commands from there. The repo root holds docs and Claude config.
> Heed [`my-app/AGENTS.md`](my-app/AGENTS.md): this is **Next.js 16**, which differs from older training data — verify APIs against `my-app/node_modules/next/dist/docs/` before using them.

## Tech stack

| Area | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript (strict) |
| Database | MongoDB Atlas + Mongoose |
| Auth | Auth.js v5 (NextAuth) — Credentials **and** Google, **JWT** strategy, no DB adapter |
| Styling | Tailwind v4 (CSS-first) + shadcn/ui + Lucide |
| Data/State | TanStack Query + Zustand |
| Validation | Zod |
| Later phases | Pusher/Ably (realtime), BullMQ + Redis (jobs), UploadThing/S3 (files), Sentry |

## Architecture — modular monolith, 4 layers

- **Presentation** — `src/app/**` (pages, layouts, route handlers), `src/components/**`.
- **Application** — `src/modules/<domain>/server/{actions,queries,permissions,dto}` — the business engine.
- **Data** — `src/models/**` (one file per collection), `src/lib/mongo/**` (ids, pagination, transactions).
- **Infrastructure** — `src/lib/**`: `db`, `auth`, `env`, `logger`, `api/{response,handler}` (later: `redis`, `pusher`, `queue`, `upload`).

## Hard rules (non-negotiable)

These are summarized here and detailed in `.claude/rules/`:

- **Workspace scoping** — every business doc stores `workspaceId`; **never** query tasks without it (`Task.find({ workspaceId, projectId, … })`, never `Task.find({ projectId })`). → `.claude/rules/data-and-mongoose.md`
- **Own collections** — comments, tasks, and activity each get their own collection; never embed unbounded arrays on a parent. → `.claude/rules/data-and-mongoose.md`
- **Verify ownership chains** on every mutation: user∈workspace, project∈workspace, section∈project. Never trust client-sent IDs. → `.claude/rules/api-auth-security.md`
- **One funnel for APIs** — all route handlers go through `lib/api/handler` + `lib/api/response` (`{ ok, data, error }`). Move/reorder logic lives only in the task service. → `.claude/rules/api-auth-security.md`
- **Auth via the DAL** — `getCurrentUser`/`requireUser` (React `cache`); treat Server Actions & Route Handlers as public endpoints (authz inside). → `.claude/rules/api-auth-security.md`
- **Next.js 16 reality** — `proxy.ts` not `middleware.ts`; `await cookies()/headers()/params`; Tailwind v4 CSS-first; global-cached Mongoose singleton for HMR. → `.claude/rules/nextjs16.md`
- **Code style** — TS strict, no `any`; `@/*` imports; Server Components by default; Zod for all external input. → `.claude/rules/code-style.md`

## Commands (run inside `my-app/`)

```bash
npm run dev      # start dev server (Turbopack) at :3000
npm run build    # production build + typecheck
npm run lint     # eslint
```

## Working in this repo

- The full build is sequenced in **[`Docs/IMPLEMENTATION-PLAN.md`](Docs/IMPLEMENTATION-PLAN.md)** — read the relevant phase (and its "Done when" gate) before implementing it. Use `/phase <n>` to start one.
- Scaffolding helpers: `/new-model <Name>`, `/scaffold-module <domain>`.
- Subagents: `schema-reviewer` (data-layer review), `nextjs16-guide` (verify Next 16 APIs).
- Repeatable blueprint for new features: `.claude/workflows/add-feature.md`.
