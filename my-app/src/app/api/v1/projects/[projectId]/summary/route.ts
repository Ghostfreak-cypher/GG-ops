import { handleAuthed } from "@/lib/api/handler";
import { ok, err } from "@/lib/api/response";
import { getProjectBoard } from "@/modules/task/server/queries";
import { summarizeBoard } from "@/modules/task/server/board-summary";

type Ctx = { params: Promise<{ projectId: string }> };

/**
 * GET /api/v1/projects/[projectId]/summary — status and task counts, no task content.
 *
 * Same access rule as the board: `getProjectBoard` returns null unless the caller is an
 * active member of the project's workspace. Descriptions are skipped — nothing here uses them.
 */
export const GET = handleAuthed(async (_req, user, ctx: Ctx) => {
  const { projectId } = await ctx.params;
  const board = await getProjectBoard(projectId, user.id, {}, false);
  if (!board) return err("Not found", 404);

  return ok(summarizeBoard(board));
});
