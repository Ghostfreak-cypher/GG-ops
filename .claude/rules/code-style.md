# Code style

TypeScript + React 19 + Next.js 16 App Router conventions for this repo. Match surrounding code first; this is the default when none exists.

## TypeScript
- `strict` is on. **No `any`** — use `unknown` + narrowing, or a real type. Avoid non-null `!` unless provably safe.
- Prefer `type` aliases for data shapes; `interface` only when extending.
- Validate **all external input** (request bodies, params, form data, env) with **Zod** at the boundary; infer types from schemas with `z.infer`.
- Use the `@/*` path alias (→ `src/*`); no deep relative `../../../` imports.

## React / Next
- **Server Components by default.** Add `'use client'` only when you need state, effects, browser APIs, or event handlers. Keep client components small and at the leaves.
- Data fetching: in Server Components / the DAL on the server; **TanStack Query** for client-side fetching/mutations; **Zustand** only for genuinely client-global UI state.
- Don't hand-roll `useMemo`/`useCallback` micro-optimizations — the **React Compiler is enabled** (see `nextjs16.md`).

## Files & naming
- One responsibility per file; when a file grows large, split it. Colocate by domain under `src/modules/<domain>/`.
- Filenames **kebab-case** (`task-card.tsx`, `create-task.ts`). Components **PascalCase**, functions/vars **camelCase**, constants **UPPER_SNAKE**, types **PascalCase**.
- Enums/string-unions for fixed sets (status, priority, role) — keep values UPPER_SNAKE to match the data model.

## Styling
- **Tailwind v4** utility classes; compose conditional classes with `cn()` (`src/lib/utils.ts`). Use shadcn/ui primitives from `src/components/ui` rather than re-building.

## General
- Small, pure, well-named functions over clever one-liners.
- No dead code, no commented-out blocks, no console noise — use the `logger` (`src/lib/logger.ts`).
