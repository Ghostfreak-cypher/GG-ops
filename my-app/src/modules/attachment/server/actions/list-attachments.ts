"use server";

import { connectDB } from "@/lib/db";
import { Task } from "@/models/Task";
import { listAttachments, type AttachmentDTO } from "@/modules/attachment/server/queries";
import { getProjectForUser } from "@/modules/project/server/access";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { requireUser } from "@/modules/auth/server/session";
import type { ActionResult } from "@/lib/action-result";

/**
 * List a task's attachments for a client component. Re-verifies that the caller
 * is a member of the task's project before returning anything — never trust the
 * client-sent taskId.
 */
export async function listAttachmentsAction(
  taskId: string,
): Promise<ActionResult<AttachmentDTO[]>> {
  const user = await requireUser();
  await connectDB();

  const task = await Task.findById(parseObjectIdOrThrow(taskId)).lean();
  if (!task) return { ok: false, error: "Task not found." };

  const access = await getProjectForUser(String(task.projectId), user.id);
  if (!access) return { ok: false, error: "Not allowed." };

  const data = await listAttachments(taskId);
  return { ok: true, data };
}
