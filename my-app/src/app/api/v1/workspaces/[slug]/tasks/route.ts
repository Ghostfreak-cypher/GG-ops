import { handleAuthed } from "@/lib/api/handler";
import { ok, err } from "@/lib/api/response";
import { getWorkspaceForUser } from "@/modules/workspace/server/queries";
import { searchTasks } from "@/modules/task/server/queries";

type Ctx = { params: Promise<{ slug: string }> };

/**
 * GET /api/v1/workspaces/[slug]/tasks?q=&projectId= — workspace-wide task search.
 *
 * ⚠️ This is the highest-severity of the caller-must-check routes. `searchTasks` says so
 * in its own doc comment ("Verify access in the caller") — without the
 * `getWorkspaceForUser` gate below, any authenticated key holder could read task titles
 * and descriptions out of a workspace they aren't in just by guessing its slug.
 *
 * `searchTasks` returns [] for queries shorter than 2 chars and ignores `projectId`
 * unless it is a valid ObjectId; both are its own behaviour, not re-implemented here.
 */
export const GET = handleAuthed(async (req, user, ctx: Ctx) => {
  const { slug } = await ctx.params;
  const ws = await getWorkspaceForUser(slug, user.id);
  if (!ws) return err("Not found", 404);

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const projectId = url.searchParams.get("projectId") ?? undefined;

  return ok(await searchTasks(ws.id, q, projectId));
});
