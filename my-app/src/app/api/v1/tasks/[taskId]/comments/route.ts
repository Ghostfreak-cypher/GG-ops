import { handleAuthed } from "@/lib/api/handler";
import { ok, err } from "@/lib/api/response";
import { listComments } from "@/modules/comment/server/queries";
import { createCommentAction } from "@/modules/comment/server/actions/create-comment";

type Ctx = { params: Promise<{ taskId: string }> };

/**
 * GET /api/v1/tasks/[taskId]/comments — root comments with replies nested one level.
 *
 * `listComments` is self-checking and returns [] for a non-member. That was NOT true when
 * Docs/API-V1-CONTRACT.md was written — the query had no membership check at all, and this
 * route as specified would have leaked every comment body in the database to any key
 * holder who knew a task ObjectId. The query was fixed rather than guarded here, so all
 * callers benefit. See src/modules/comment/server/queries/index.test.ts.
 */
export const GET = handleAuthed(async (_req, user, ctx: Ctx) => {
  const { taskId } = await ctx.params;
  return ok(await listComments(taskId, user.id));
});

/**
 * POST /api/v1/tasks/[taskId]/comments — add a comment. Body: createCommentSchema.
 * Returns `null`: the action does not hand back the created comment. Re-fetch via GET
 * if the id is needed.
 */
export const POST = handleAuthed(async (req, _user, ctx: Ctx) => {
  const { taskId } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const result = await createCommentAction(taskId, body);
  return result.ok ? ok(null, 201) : err(result.error, 400);
});
