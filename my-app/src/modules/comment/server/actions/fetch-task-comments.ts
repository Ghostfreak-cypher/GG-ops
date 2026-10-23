"use server";

import { listComments } from "@/modules/comment/server/queries";
import { requireUser } from "@/modules/auth/server/session";
import type { CommentDTO } from "@/modules/comment/server/queries";
import type { ActionResult } from "@/lib/action-result";

export async function fetchTaskCommentsAction(
  taskId: string,
): Promise<ActionResult<CommentDTO[]>> {
  const user = await requireUser();
  const comments = await listComments(taskId, user.id);
  return { ok: true, data: comments };
}
