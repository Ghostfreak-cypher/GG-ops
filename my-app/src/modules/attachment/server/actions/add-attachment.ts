"use server";

import { connectDB } from "@/lib/db";
import { Attachment } from "@/models/Attachment";
import { Task } from "@/models/Task";
import { createAttachmentSchema } from "@/modules/attachment/schemas";
import { getProjectForUser } from "@/modules/project/server/access";
import { canEditTasks } from "@/modules/workspace/server/permissions";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { requireUser } from "@/modules/auth/server/session";
import type { ActionResult } from "@/lib/action-result";

export async function addAttachmentAction(
  taskId: string,
  input: unknown,
): Promise<ActionResult> {
  const user = await requireUser();
  await connectDB();

  const task = await Task.findById(parseObjectIdOrThrow(taskId)).lean();
  if (!task) return { ok: false, error: "Task not found." };

  const access = await getProjectForUser(String(task.projectId), user.id);
  if (!access) return { ok: false, error: "Not allowed." };
  if (!canEditTasks(access.role)) return { ok: false, error: "You don't have permission." };

  const parsed = createAttachmentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await Attachment.create({
    workspaceId: parseObjectIdOrThrow(access.project.workspaceId),
    projectId: task.projectId,
    taskId: parseObjectIdOrThrow(taskId),
    uploadedBy: parseObjectIdOrThrow(user.id),
    fileName: parsed.data.fileName,
    fileUrl: parsed.data.fileUrl,
    mimeType: parsed.data.mimeType ?? null,
    fileSize: parsed.data.fileSize ?? 0,
    storageKey: parsed.data.storageKey ?? null,
  });
  return { ok: true };
}
