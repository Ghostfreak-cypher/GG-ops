---
description: Scaffold a domain module in the 4-layer modular-monolith pattern
argument-hint: <domain>
---

Scaffold the domain module `$ARGUMENTS` under `my-app/src/modules/$ARGUMENTS/`, following the architecture in `CLAUDE.md` and the rules in `.claude/rules/`.

Create this structure with minimal, typed stubs (no business logic yet — just the seams):

```
src/modules/$ARGUMENTS/
├─ server/
│  ├─ actions/      # mutations (Server Actions / called by route handlers)
│  ├─ queries/      # read functions (workspace-scoped)
│  ├─ permissions/  # can<Action>(member, entity) helpers
│  └─ dto/          # shapes returned to the client (no raw Mongo docs)
├─ ui/              # domain components
└─ schemas/         # Zod schemas for this domain's inputs
```

Conventions:
- Queries are **always workspace-scoped** and call `connectDB()` first.
- Mutations verify ownership chains + permissions before writing (see `.claude/rules/api-auth-security.md`).
- Export DTOs, not Mongoose documents.

Keep stubs small and well-named; do not invent endpoints beyond what the relevant phase in `Docs/IMPLEMENTATION-PLAN.md` calls for.
