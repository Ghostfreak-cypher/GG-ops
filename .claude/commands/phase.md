---
description: Implement a numbered phase from the implementation plan
argument-hint: <phase-number>
---

Implement **Phase $ARGUMENTS** of this project.

1. Read `Docs/IMPLEMENTATION-PLAN.md` and locate "Phase $ARGUMENTS". Note its **Goal**, **Models**, **Modules/files**, **Surface (routes/actions)**, and especially its **"Done when"** checklist.
2. Read the relevant `.claude/rules/*.md` (data-and-mongoose, api-auth-security, nextjs16, code-style) and follow them strictly.
3. If anything in the phase is ambiguous or under-specified, ask before building — don't guess at product behavior.
4. Build incrementally with **test-driven development** where logic warrants it. Reuse existing utilities (`lib/db`, `lib/api/*`, `lib/mongo/ids`, the auth DAL) rather than re-creating them.
5. For any new model, run the `schema-reviewer` subagent. For any uncertainty about a Next.js 16 API, use the `nextjs16-guide` subagent instead of assuming.
6. Verify against the phase's **"Done when"** gate: run `npm run build` in `my-app/`, then exercise the listed end-to-end behaviors. Report results with evidence — don't claim done without verifying.

Do not pull in work from later phases. Stay within Phase $ARGUMENTS's scope.
