# Data & Mongoose

How collections and queries are modeled. The single most important discipline in this codebase.

## Models
- **One file per collection** in `src/models/` (e.g. `Task.ts`, `Project.ts`). No mega-model file.
- Use the Next-safe bootstrap to avoid HMR recompilation errors:
  ```ts
  export const Task = (models.Task as Model<ITask>) || model<ITask>("Task", TaskSchema);
  ```
- `{ timestamps: true }` on every schema. Export a TS interface (`ITask`) alongside the model.
- **Always `await connectDB()`** (`src/lib/db.ts`) before any query — it's the only way to touch Mongo.

## Workspace scoping (hard rule)
- **Every business collection stores `workspaceId`**: projects, sections, tasks, comments, notifications, activity logs, attachments.
- **Never** run a task query without it. Bad: `Task.find({ projectId })`. Good: `Task.find({ workspaceId, projectId, isArchived: false })`.

## Indexing
- Design indexes for **board** and **my-tasks** reads first, not generic CRUD. Representative:
  - Board: `{ projectId: 1, sectionId: 1, position: 1 }`
  - My Tasks: `{ workspaceId: 1, assigneeIds: 1, dueDate: 1 }`
  - Project listing: `{ workspaceId: 1, projectId: 1, isArchived: 1 }`
  - Subtasks: `{ parentTaskId: 1 }`
- Unique constraints where the spec requires (e.g. `workspace_members { workspaceId, userId }`, invite `token`).

## Shape discipline
- **Never embed unbounded arrays** on a parent doc. Comments, tasks, and activity logs each get their **own collection**.
- References for relationships; **small denormalized snapshots** (e.g. `projectNameSnapshot`) only when there's a real read/UI reason.
- Keep `assigneeIds`/`labelIds` as ID arrays on the task (good for filtering) — that's intentional, not over-embedding.

## Querying
- Prefer **"gather IDs → fetch users once → map in memory"** over deep `populate` chains on heavy pages (board, task detail).
- Validate/parse ObjectIds with `src/lib/mongo/ids.ts` (`isValidObjectId`, `parseObjectIdOrThrow`) — never trust raw route params.
- Multi-document writes that must stay consistent (task move/reorder, invite acceptance) use a **transaction** (`src/lib/mongo/transactions.ts`).
