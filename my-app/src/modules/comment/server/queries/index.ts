import { connectDB } from "@/lib/db";
import { Comment } from "@/models/Comment";
import { CommentReaction } from "@/models/CommentReaction";
import { Attachment } from "@/models/Attachment";
import { Task } from "@/models/Task";
import { User } from "@/models/User";
import { getProjectForUser } from "@/modules/project/server/access";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";

export type CommentAttachmentDTO = {
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
};

export type ReactionSummary = {
  emoji: string;
  count: number;
  myReaction: boolean;
};

export type CommentDTO = {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  authorImage: string | null;
  createdAt: string;
  parentCommentId: string | null;
  attachments: CommentAttachmentDTO[];
  reactions: ReactionSummary[];
  replies: CommentDTO[];
};

/**
 * Comments for a task, structured as a one-level tree, oldest first.
 *
 * Self-checking: verifies `viewerId` is an ACTIVE member of the task's workspace and
 * returns `[]` if not. Comment bodies are freeform user content — a caller holding only
 * a task ObjectId (an agent on `/api/v1`, an MCP tool) must not be able to read them
 * out of a workspace it isn't in. Same `Task` → `getProjectForUser` chain that
 * `createCommentAction` uses; `getProjectForUser` is `cache()`d, so callers that already
 * resolved access (the task-detail page) pay nothing for the second check.
 */
export async function listComments(
  taskId: string,
  viewerId: string,
): Promise<CommentDTO[]> {
  await connectDB();

  const tid = parseObjectIdOrThrow(taskId);

  const task = await Task.findById(tid).select("projectId").lean();
  if (!task) return [];
  if (!(await getProjectForUser(String(task.projectId), viewerId))) return [];

  const comments = await Comment.find({
    taskId: tid,
    deletedAt: null,
  })
    .sort({ createdAt: 1 })
    .lean();

  if (comments.length === 0) return [];

  const commentIds = comments.map((c) => c._id);
  const authorIds = [...new Set(comments.map((c) => String(c.authorId)))];

  const [users, allAttachments, allReactions] = await Promise.all([
    User.find({ _id: { $in: authorIds } }).select("name image").lean(),
    Attachment.find({ commentId: { $in: commentIds } })
      .select("commentId fileName fileUrl mimeType fileSize")
      .lean(),
    CommentReaction.find({ commentId: { $in: commentIds } })
      .select("commentId userId emoji")
      .lean(),
  ]);

  const byUserId = new Map(users.map((u) => [String(u._id), u]));

  // attachments grouped by commentId
  const attachmentsByComment = new Map<string, CommentAttachmentDTO[]>();
  for (const a of allAttachments) {
    const key = String(a.commentId);
    const list = attachmentsByComment.get(key) ?? [];
    list.push({
      fileUrl: a.fileUrl,
      fileName: a.fileName,
      mimeType: a.mimeType ?? "",
      fileSize: a.fileSize ?? 0,
    });
    attachmentsByComment.set(key, list);
  }

  // reactions grouped by commentId → emoji → { count, mine }
  type EmojiAgg = { count: number; mine: boolean };
  const reactionsByComment = new Map<string, Map<string, EmojiAgg>>();
  for (const r of allReactions) {
    const cid = String(r.commentId);
    const emojiMap = reactionsByComment.get(cid) ?? new Map<string, EmojiAgg>();
    const prev = emojiMap.get(r.emoji) ?? { count: 0, mine: false };
    emojiMap.set(r.emoji, {
      count: prev.count + 1,
      mine: prev.mine || String(r.userId) === viewerId,
    });
    reactionsByComment.set(cid, emojiMap);
  }

  const toDTO = (c: (typeof comments)[number]): CommentDTO => {
    const u = byUserId.get(String(c.authorId));
    const cid = String(c._id);
    const emojiMap = reactionsByComment.get(cid);
    const reactions: ReactionSummary[] = emojiMap
      ? [...emojiMap.entries()].map(([emoji, { count, mine }]) => ({
          emoji,
          count,
          myReaction: mine,
        }))
      : [];
    return {
      id: cid,
      body: c.body,
      authorId: String(c.authorId),
      authorName: u?.name ?? "Unknown",
      authorImage: u?.image ?? null,
      createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : "",
      parentCommentId: c.parentCommentId ? String(c.parentCommentId) : null,
      attachments: attachmentsByComment.get(cid) ?? [],
      reactions,
      replies: [],
    };
  };

  // Build one-level tree
  const roots: CommentDTO[] = [];
  const repliesMap = new Map<string, CommentDTO[]>();

  for (const c of comments) {
    const pid = c.parentCommentId ? String(c.parentCommentId) : null;
    const dto = toDTO(c);
    if (!pid) {
      roots.push(dto);
    } else {
      const list = repliesMap.get(pid) ?? [];
      list.push(dto);
      repliesMap.set(pid, list);
    }
  }

  for (const root of roots) {
    root.replies = repliesMap.get(root.id) ?? [];
  }

  return roots;
}
