# Workflow: Add a domain feature

A repeatable blueprint for adding a feature to a domain (task, project, comment, …). Follow the steps in order; each cites the rule/asset that governs it.

## 1. Understand & locate
- Find the feature in `Docs/IMPLEMENTATION-PLAN.md` (which phase, which "Done when" gate). Clarify product behavior with the user if ambiguous.
- Identify the domain module under `src/modules/<domain>/`. If it doesn't exist, run `/scaffold-module <domain>`.

## 2. Data layer
- Add/extend the model in `src/models/` per `.claude/rules/data-and-mongoose.md` (workspaceId, indexes-for-queries, bootstrap export). For a new model use `/new-model <Name>`.
- Hand new/changed models to the **`schema-reviewer`** subagent; address blocking findings.

## 3. Application layer
- Write the read in `server/queries/` (always workspace-scoped, `connectDB()` first) and the mutation in `server/actions/`.
- Add permission checks in `server/permissions/` and the Zod input schema in `schemas/`.
- Mutations must verify ownership chains before writing (`.claude/rules/api-auth-security.md`).

## 4. Surface
- Expose via a Route Handler (through `lib/api/handler` + `response`) or a Server Action. Treat it as a public endpoint: re-check auth (`requireUser`) + permissions inside.
- For anything touching Next.js routing/runtime, confirm conventions with the **`nextjs16-guide`** subagent (`.claude/rules/nextjs16.md`).

## 5. UI
- Build components in `src/modules/<domain>/ui/` (Server Components by default; `'use client'` only at interactive leaves). Use TanStack Query for client mutations with optimistic updates where it improves UX. Return DTOs, never raw Mongo docs.

## 6. Side effects
- Write an `ActivityLog` entry for meaningful changes (create/update/move/assign/complete). Enqueue notifications/emails where the phase calls for it (later phases).

## 7. Verify (don't skip)
- Use TDD for non-trivial logic. Run `npm run build` (in `my-app/`) and exercise the feature's **"Done when"** behaviors end-to-end. Report results with evidence before calling it done.
