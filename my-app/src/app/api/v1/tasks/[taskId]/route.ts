import { handleAuthed } from "@/lib/api/handler";
import { ok, err } from "@/lib/api/response";
import { fetchTaskDetailAction } from "@/modules/task/server/actions/fetch-task-detail";
import { updateTaskAction } from "@/modules/task/server/actions/update-task";
import { archiveTaskAction } from "@/modules/task/server/actions/archive-task";

type Ctx = { params: Promise<{ taskId: string }> };

/**
 * GET /api/v1/tasks/[taskId] — task detail with labels and subtasks.
 *
 * No extra guard: the action wraps `getTaskDetail`, which calls `getProjectForUser`.
 * A caller who isn't a member gets the same 404 as a caller using a bogus id — we
 * deliberately don't distinguish "exists but forbidden" from "doesn't exist".
 */
export const GET = handleAuthed(async (_req, _user, ctx: Ctx) => {
  const { taskId } = await ctx.params;
  const result = await fetchTaskDetailAction(taskId);
  return result.ok && result.data ? ok(result.data) : err("Not found", 404);
});

/** PATCH /api/v1/tasks/[taskId] — partial update. Body: updateTaskSchema. */
export const PATCH = handleAuthed(async (req, _user, ctx: Ctx) => {
  const { taskId } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const result = await updateTaskAction(taskId, body);
  return result.ok ? ok(null) : err(result.error, 400);
});

/** DELETE /api/v1/tasks/[taskId] — archives (soft-deletes) the task. */
export const DELETE = handleAuthed(async (_req, _user, ctx: Ctx) => {
  const { taskId } = await ctx.params;
  const result = await archiveTaskAction(taskId);
  return result.ok ? ok(null) : err(result.error, 400);
});
