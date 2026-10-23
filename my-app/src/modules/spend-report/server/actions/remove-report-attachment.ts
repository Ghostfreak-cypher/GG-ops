"use server";

import { connectDB } from "@/lib/db";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { Attachment } from "@/models/Attachment";
import { canEditSpendReport, requireFinanceWorkspace } from "@/modules/spend-report/access";
import type { ActionResult } from "@/lib/action-result";

export async function removeReportAttachmentAction(attachmentId: string): Promise<ActionResult> {
  const { workspace, role } = await requireFinanceWorkspace();
  if (!canEditSpendReport(role)) return { ok: false, error: "You don't have permission." };

  await connectDB();
  const attachmentObjectId = parseObjectIdOrThrow(attachmentId);
  const workspaceId = parseObjectIdOrThrow(workspace.id);

  const result = await Attachment.deleteOne({
    _id: attachmentObjectId,
    workspaceId,
    reportId: { $ne: null },
  });
  if (result.deletedCount === 0) return { ok: false, error: "Attachment not found." };

  return { ok: true };
}
