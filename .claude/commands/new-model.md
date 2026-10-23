---
description: Scaffold a new Mongoose model following this repo's conventions
argument-hint: <ModelName>
---

Create a new Mongoose model `$ARGUMENTS` at `my-app/src/models/$ARGUMENTS.ts`, following `.claude/rules/data-and-mongoose.md`.

Requirements:
1. Export a TS interface `I$ARGUMENTS` describing the document.
2. Define the schema with `{ timestamps: true }`.
3. Include `workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true }` (unless this IS the Workspace/User model — confirm before omitting).
4. Use string-union enums (UPPER_SNAKE values) for any fixed-set fields.
5. Add the indexes that match how this collection will actually be queried (board / my-tasks / listing patterns) — list your reasoning.
6. Export with the HMR-safe bootstrap: `export const $ARGUMENTS = models.$ARGUMENTS || model<I$ARGUMENTS>("$ARGUMENTS", schema);`.

Before writing, check `Docs/IMPLEMENTATION-PLAN.md` for the spec'd shape/indexes of this collection. After writing, confirm `npm run build` (in `my-app/`) typechecks, then hand the file to the `schema-reviewer` subagent.
