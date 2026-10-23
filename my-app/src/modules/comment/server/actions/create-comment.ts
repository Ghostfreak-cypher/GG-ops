"use server";

import { connectDB } from "@/lib/db";
import { Comment } from "@/models/Comment";
import { Attachment } from "@/models/Attachment";
import { Task } from "@/models/Task";
import { Workspace } from "@/models/Workspace";
import { createCommentSchema } from "@/modules/comment/schemas";
import { resolveMentionRecipients } from "@/lib/mentions";
import { getProjectForUser } from "@/modules/project/server/access";
import { canEditTasks } from "@/modules/workspace/server/permissions";
import { listMembers } from "@/modules/workspace/server/queries";
import { notify } from "@/modules/notification/server/create";
import { logActivity } from "@/modules/activity/log";
import { publish } from "@/lib/pusher";
import { enqueue } from "@/lib/queue";
import { enqueueNewCommentEmails } from "@/lib/jobs/task-email";
import { canSendWorkspaceEmail } from "@/lib/notification-preferences";
import { absoluteUrl } from "@/lib/urls";
import { rateLimit } from "@/lib/rate-limit";
import { getPlainText } from "@/lib/get-plain-text";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { requireUser } from "@/modules/auth/server/session";
import type { ActionResult } from "@/lib/action-result";

export async function createCommentAction(
  taskId: string,
  input: unknown,
): Promise<ActionResult> {
  const user = await requireUser();
  await connectDB();

  const task = await Task.findById(parseObjectIdOrThrow(taskId)).lean();
  if (!task) return { ok: false, error: "Task not found." };

  const access = await getProjectForUser(String(task.projectId), user.id);
  if (!access) return { ok: false, error: "Not allowed." };
  if (!canEditTasks(access.role)) {
    return { ok: false, error: "You don't have permission to comment." };
  }
  const limited = await rateLimit(`comment:${taskId}:${user.id}`, 30, 300);
  if (!limited.allowed) return { ok: false, error: "Too many comments. Try again later." };

  const parsed = createCommentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const members = await listMembers(access.project.workspaceId);
  const { explicitIds, allIds } = resolveMentionRecipients(
    parsed.data.body,
    members.map((m) => ({ userId: m.userId, name: m.name, email: m.email })),
    user.id,
  );
  const mentionedUserIds = [...explicitIds, ...allIds];

  const workspaceOid = parseObjectIdOrThrow(access.project.workspaceId);
  const taskOid = parseObjectIdOrThrow(taskId);

  // Validate parentCommentId belongs to the same task (prevents cross-task thread injection)
  let parentCommentOid = null;
  if (parsed.data.parentCommentId) {
    const parent = await Comment.findById(parseObjectIdOrThrow(parsed.data.parentCommentId))
      .select("taskId deletedAt")
      .lean();
    if (!parent || parent.deletedAt || String(parent.taskId) !== taskId) {
      return { ok: false, error: "Invalid parent comment." };
    }
    parentCommentOid = parent._id;
  }

  const comment = await Comment.create({
    workspaceId: workspaceOid,
    projectId: task.projectId,
    taskId: taskOid,
    authorId: parseObjectIdOrThrow(user.id),
    body: parsed.data.body,
    mentionedUserIds: mentionedUserIds.map((id) => parseObjectIdOrThrow(id)),
    parentCommentId: parentCommentOid,
  });

  if (parsed.data.attachments?.length) {
    await Attachment.insertMany(
      parsed.data.attachments.map((a) => ({
        workspaceId: workspaceOid,
        projectId: task.projectId,
        taskId: taskOid,
        commentId: comment._id,
        uploadedBy: parseObjectIdOrThrow(user.id),
        fileName: a.fileName,
        fileUrl: a.fileUrl,
        mimeType: a.mimeType ?? null,
        fileSize: a.fileSize ?? 0,
        storageKey: a.storageKey ?? null,
      })),
    );
  }

  if (mentionedUserIds.length > 0) {
    const explicit = new Set(explicitIds);
    await notify(
      mentionedUserIds.map((uid) => ({
        userId: uid,
        workspaceId: access.project.workspaceId,
        type: "COMMENT_MENTION",
        title: `${user.name ?? "Someone"} mentioned ${explicit.has(uid) ? "you" : "everyone"}`,
        body: getPlainText(parsed.data.body),
        entityType: "TASK",
        entityId: taskId,
      })),
    );

    // Async mention emails — explicit @mentions only; @all stays in-app.
    const wsDoc = await Workspace.findById(parseObjectIdOrThrow(access.project.workspaceId))
      .select("slug")
      .lean();
    const memberByUserId = new Map(members.map((m) => [m.userId, m]));
    for (const uid of explicitIds) {
      const m = memberByUserId.get(uid);
      if (m?.email && wsDoc?.slug && (await canSendWorkspaceEmail(uid, access.project.workspaceId, "COMMENT_MENTION"))) {
        enqueue("mention-email", {
          email: m.email,
          by: user.name ?? "Someone",
          taskTitle: task.title,
          taskUrl: absoluteUrl(
            `/w/${wsDoc.slug}/projects/${String(task.projectId)}/tasks/${taskId}`,
          ),
          preview: getPlainText(parsed.data.body),
        });
      }
    }
  }

  await logActivity({
    workspaceId: access.project.workspaceId,
    projectId: String(task.projectId),
    taskId,
    actorId: user.id,
    action: "COMMENT_ADDED",
  });

  // Notify assignees + creator (not the commenter, not already-mentioned users)
  await enqueueNewCommentEmails(
    {
      workspaceId: String(task.workspaceId),
      projectId: String(task.projectId),
      taskId,
      taskTitle: task.title,
      assigneeIds: (task.assigneeIds ?? []).map(String),
      createdBy: String(task.createdBy),
    },
    user.name ?? "Someone",
    user.id,
    getPlainText(parsed.data.body),
  );

  await publish(`task-${taskId}`, "comment.created", { id: String(comment._id) });
  return { ok: true };
}
