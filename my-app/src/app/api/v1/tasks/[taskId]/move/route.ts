import { handleAuthed } from "@/lib/api/handler";
import { ok, err } from "@/lib/api/response";
import { moveTaskAction } from "@/modules/task/server/actions/move-task";

type Ctx = { params: Promise<{ taskId: string }> };

/**
 * POST /api/v1/tasks/[taskId]/move — move/reorder within or across sections.
 * Body: moveTaskSchema `{ destSectionId: string | null, orderedIds: string[] }`.
 *
 * All move/reorder logic lives in the task service action — never re-implement the
 * position maths here (see .claude/rules/api-auth-security.md).
 */
export const POST = handleAuthed(async (req, _user, ctx: Ctx) => {
  const { taskId } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const result = await moveTaskAction(taskId, body);
  return result.ok ? ok(null) : err(result.error, 400);
});
