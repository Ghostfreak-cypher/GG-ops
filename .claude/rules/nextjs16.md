# Next.js 16 gotchas

This repo runs **Next.js 16.2.x + React 19**, which has breaking changes vs. older training data. Verified against the installed docs (`my-app/node_modules/next/dist/docs/`). **When unsure about a Next API, read those docs (or use the `nextjs16-guide` subagent) — do not assume.**

## Routing & middleware
- **`middleware.ts` → `proxy.ts`** (root or `src/`, sibling to `app/`). Same capability; runs on the **Node.js runtime**. Export a `proxy` function + `config.matcher`. Use only for optimistic cookie checks/redirects — never DB/session lookups.
- **Async request APIs**: `await cookies()`, `await headers()`. Route handler params are a Promise: `const { id } = await ctx.params`. Type context with the global `RouteContext<'/path/[id]'>` helper.
- Route handlers live in `app/**/route.ts` exporting `GET/POST/...`; not cached by default.

## Auth interrupts
- `forbidden()`, `unauthorized()`, `forbidden.js`, `unauthorized.js`, and `authInterrupts` are **canary-only — NOT in stable 16.2.x**. Do **not** use them; return explicit `Response`/`redirect()` instead.

## Styling
- **Tailwind v4 is CSS-first**: `@import "tailwindcss"` + `@theme` in `globals.css`. **There is no `tailwind.config.js`.**
- shadcn/ui must use its **Tailwind-v4 path** (`npx shadcn@latest init`; emits `tw-animate-css`, not `tailwindcss-animate`). Add `--legacy-peer-deps` if the CLI balks at React 19.

## Build / runtime
- **React Compiler is enabled** (`reactCompiler: true` in `next.config.ts`) — don't add manual `useMemo`/`useCallback` micro-optimizations; let the compiler handle memoization.
- **Dev uses Turbopack.** The Mongoose connection **must** be a `global`-cached singleton (`src/lib/db.ts`) and models must use the `models.X || model(...)` bootstrap, or HMR throws "model recompilation" / opens connection storms.

## Auth.js v5 on Next 16
- `next-auth@beta` (v5) may warn against the Next 16 peer range — install with `--legacy-peer-deps`/`overrides` if needed. Confirm it honors `proxy.ts`; if not, use a manual `proxy.ts` that reads the token via `auth()`.
