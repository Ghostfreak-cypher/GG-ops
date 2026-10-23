import { handleAuthed } from "@/lib/api/handler";
import { ok, err } from "@/lib/api/response";
import { getWorkspaceForUser } from "@/modules/workspace/server/queries";
import { listProjects } from "@/modules/project/server/queries";

type Ctx = { params: Promise<{ slug: string }> };

/**
 * GET /api/v1/workspaces/[slug]/projects
 *
 * ⚠️ `listProjects(workspaceId)` runs its query with NO membership check — it trusts the
 * id it is handed. The `getWorkspaceForUser` call below is the authorization boundary:
 * it resolves the slug only if the caller is an ACTIVE member, and we pass the id IT
 * returns, never one supplied by the client.
 */
export const GET = handleAuthed(async (_req, user, ctx: Ctx) => {
  const { slug } = await ctx.params;
  const ws = await getWorkspaceForUser(slug, user.id);
  if (!ws) return err("Not found", 404);

  return ok(await listProjects(ws.id));
});
