import { handleAuthed } from "@/lib/api/handler";
import { ok, err } from "@/lib/api/response";
import { getWorkspaceForUser, listMembers } from "@/modules/workspace/server/queries";

type Ctx = { params: Promise<{ slug: string }> };

/**
 * GET /api/v1/workspaces/[slug]/members
 *
 * ⚠️ `listMembers(workspaceId)` has no membership check of its own — see the note in
 * `../projects/route.ts`. Includes INVITED members (excludes REMOVED); `email` may be `""`.
 */
export const GET = handleAuthed(async (_req, user, ctx: Ctx) => {
  const { slug } = await ctx.params;
  const ws = await getWorkspaceForUser(slug, user.id);
  if (!ws) return err("Not found", 404);

  return ok(await listMembers(ws.id));
});
