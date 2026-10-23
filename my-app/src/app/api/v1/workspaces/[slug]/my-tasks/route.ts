import { handleAuthed } from "@/lib/api/handler";
import { ok, err } from "@/lib/api/response";
import { getWorkspaceForUser } from "@/modules/workspace/server/queries";
import { getMyTasks } from "@/modules/dashboard/server/queries";

type Ctx = { params: Promise<{ slug: string }> };

/**
 * GET /api/v1/workspaces/[slug]/my-tasks — the caller's assigned tasks in one workspace.
 *
 * ⚠️ `getMyTasks(workspaceId, userId)` trusts the workspaceId it is handed. It filters by
 * `assigneeIds: userId`, so the leak surface is narrower than the other three (you'd only
 * see your own tasks) — but "narrower" is not "none", so the guard applies here too.
 *
 * Returns a flat array sorted by dueDate; there is deliberately no OVERDUE/TODAY/UPCOMING
 * bucketing — see "Known gap" in Docs/API-V1-CONTRACT.md.
 */
export const GET = handleAuthed(async (_req, user, ctx: Ctx) => {
  const { slug } = await ctx.params;
  const ws = await getWorkspaceForUser(slug, user.id);
  if (!ws) return err("Not found", 404);

  return ok(await getMyTasks(ws.id, user.id));
});
