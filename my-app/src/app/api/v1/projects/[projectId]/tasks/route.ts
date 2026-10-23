import { handleAuthed } from "@/lib/api/handler";
import { ok, err } from "@/lib/api/response";
import { getProjectBoard } from "@/modules/task/server/queries";
import { createTaskAction } from "@/modules/task/server/actions/create-task";

type Ctx = { params: Promise<{ projectId: string }> };

/**
 * GET /api/v1/projects/[projectId]/tasks — the full board (sections + unsectioned).
 *
 * No extra guard: `getProjectBoard` calls `getProjectForUser` internally and returns null
 * when the caller isn't an active member of the project's workspace.
 */
export const GET = handleAuthed(async (_req, user, ctx: Ctx) => {
  const { projectId } = await ctx.params;
  const board = await getProjectBoard(projectId, user.id);
  if (!board) return err("Not found", 404);

  return ok(board);
});

/** POST /api/v1/projects/[projectId]/tasks — create a task. Body: createTaskSchema. */
export const POST = handleAuthed(async (req, _user, ctx: Ctx) => {
  const { projectId } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const result = await createTaskAction(projectId, body);
  return result.ok ? ok(result.data ?? null, 201) : err(result.error, 400);
});
