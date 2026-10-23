"use server";

import { connectDB } from "@/lib/db";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { Attachment } from "@/models/Attachment";
import { SpendReport } from "@/models/SpendReport";
import { createAttachmentSchema } from "@/modules/attachment/schemas";
import { canEditSpendReport, requireFinanceWorkspace } from "@/modules/spend-report/access";
import type { ActionResult } from "@/lib/action-result";

export async function addReportAttachmentAction(
  reportId: string,
  input: unknown,
): Promise<ActionResult> {
  const { workspace, role, userId } = await requireFinanceWorkspace();
  if (!canEditSpendReport(role)) return { ok: false, error: "You don't have permission." };

  await connectDB();
  const workspaceId = parseObjectIdOrThrow(workspace.id);
  const reportObjectId = parseObjectIdOrThrow(reportId);

  const exists = await SpendReport.exists({ _id: reportObjectId, workspaceId });
  if (!exists) return { ok: false, error: "Report not found." };

  const parsed = createAttachmentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await Attachment.create({
    workspaceId,
    reportId: reportObjectId,
    uploadedBy: parseObjectIdOrThrow(userId),
    fileName: parsed.data.fileName,
    fileUrl: parsed.data.fileUrl,
    mimeType: parsed.data.mimeType ?? null,
    fileSize: parsed.data.fileSize ?? 0,
    storageKey: parsed.data.storageKey ?? null,
  });
  return { ok: true };
}
