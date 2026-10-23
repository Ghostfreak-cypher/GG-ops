"use server";

import { connectDB } from "@/lib/db";
import { Comment } from "@/models/Comment";
import { CommentReaction } from "@/models/CommentReaction";
import { WorkspaceMember } from "@/models/WorkspaceMember";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { requireUser } from "@/modules/auth/server/session";
import type { ActionResult } from "@/lib/action-result";
import { ALLOWED_EMOJIS, type AllowedEmoji } from "@/modules/comment/constants";

function isAllowedEmoji(e: unknown): e is AllowedEmoji {
  return ALLOWED_EMOJIS.includes(e as AllowedEmoji);
}

export async function reactToCommentAction(
  commentId: string,
  emoji: string,
  action: "add" | "remove",
): Promise<ActionResult> {
  const user = await requireUser();
  if (!isAllowedEmoji(emoji)) return { ok: false, error: "Invalid emoji." };

  await connectDB();

  const comment = await Comment.findById(parseObjectIdOrThrow(commentId))
    .select("workspaceId deletedAt")
    .lean();
  if (!comment || comment.deletedAt) return { ok: false, error: "Comment not found." };

  const membership = await WorkspaceMember.exists({
    workspaceId: comment.workspaceId,
    userId: parseObjectIdOrThrow(user.id),
    status: "ACTIVE",
  });
  if (!membership) return { ok: false, error: "Not allowed." };

  const filter = {
    workspaceId: comment.workspaceId,
    commentId: parseObjectIdOrThrow(commentId),
    userId: parseObjectIdOrThrow(user.id),
    emoji,
  };

  if (action === "add") {
    await CommentReaction.updateOne(filter, { $setOnInsert: filter }, { upsert: true });
  } else {
    await CommentReaction.deleteOne(filter);
  }

  return { ok: true };
}
