"use server";

import { connectDB } from "@/lib/db";
import { Attachment } from "@/models/Attachment";
import { getProjectForUser } from "@/modules/project/server/access";
import { canEditTasks } from "@/modules/workspace/server/permissions";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { requireUser } from "@/modules/auth/server/session";
import type { ActionResult } from "@/lib/action-result";

export async function removeAttachmentAction(attachmentId: string): Promise<ActionResult> {
  const user = await requireUser();
  await connectDB();

  const att = await Attachment.findById(parseObjectIdOrThrow(attachmentId)).lean();
  if (!att || !att.projectId) return { ok: false, error: "Attachment not found." };

  const access = await getProjectForUser(String(att.projectId), user.id);
  if (!access || !canEditTasks(access.role)) {
    return { ok: false, error: "You don't have permission." };
  }

  await Attachment.deleteOne({ _id: parseObjectIdOrThrow(attachmentId) });
  return { ok: true };
}
