import { handleAuthed } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { getUserWorkspaces } from "@/modules/workspace/server/queries";

/**
 * GET /api/v1/workspaces — every workspace the caller is an active member of.
 *
 * No guard needed: `getUserWorkspaces` derives the list from the caller's own
 * WorkspaceMember rows, so it is scoped by construction.
 */
export const GET = handleAuthed(async (_req, user) => {
  return ok(await getUserWorkspaces(user.id));
});
