"use server";

import { connectDB } from "@/lib/db";
import { Comment } from "@/models/Comment";
import { WorkspaceMember } from "@/models/WorkspaceMember";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { requireUser } from "@/modules/auth/server/session";
import { canManageMembers } from "@/modules/workspace/server/permissions";
import { publish } from "@/lib/pusher";
import { revalidatePath } from "next/cache";
import type { WorkspaceRole } from "@/modules/workspace/roles";
import type { ActionResult } from "@/lib/action-result";

export async function deleteCommentAction(
  workspaceSlug: string,
  commentId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  await connectDB();

  const comment = await Comment.findById(parseObjectIdOrThrow(commentId))
    .select("workspaceId projectId taskId authorId deletedAt")
    .lean();
  if (!comment || comment.deletedAt) return { ok: false, error: "Comment not found." };

  const membership = await WorkspaceMember.findOne({
    workspaceId: comment.workspaceId,
    userId: parseObjectIdOrThrow(user.id),
    status: "ACTIVE",
  })
    .select("role")
    .lean();
  if (!membership) return { ok: false, error: "Not allowed." };

  const isAuthor = String(comment.authorId) === user.id;
  const canModerate = canManageMembers(membership.role as WorkspaceRole);
  if (!isAuthor && !canModerate) {
    return { ok: false, error: "You can only delete your own comments." };
  }

  await Comment.updateOne({ _id: comment._id }, { $set: { deletedAt: new Date() } });

  await publish(`task-${String(comment.taskId)}`, "comment.deleted", { id: commentId });
  revalidatePath(
    `/w/${workspaceSlug}/projects/${String(comment.projectId)}/tasks/${String(comment.taskId)}`,
  );

  return { ok: true };
}
