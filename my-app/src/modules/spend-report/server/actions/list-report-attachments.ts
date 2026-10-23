"use server";

import { connectDB } from "@/lib/db";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { Attachment } from "@/models/Attachment";
import { SpendReport } from "@/models/SpendReport";
import { requireFinanceWorkspace } from "@/modules/spend-report/access";
import type { AttachmentDTO } from "@/modules/attachment/server/queries";
import type { ActionResult } from "@/lib/action-result";

/**
 * List a report's attachments. Re-verifies the report belongs to the finance workspace
 * before returning anything — never trust the client-sent reportId.
 */
export async function listReportAttachmentsAction(
  reportId: string,
): Promise<ActionResult<AttachmentDTO[]>> {
  const { workspace } = await requireFinanceWorkspace();
  await connectDB();
  const workspaceId = parseObjectIdOrThrow(workspace.id);
  const reportObjectId = parseObjectIdOrThrow(reportId);

  const exists = await SpendReport.exists({ _id: reportObjectId, workspaceId });
  if (!exists) return { ok: false, error: "Report not found." };

  const items = await Attachment.find({ workspaceId, reportId: reportObjectId })
    .sort({ createdAt: -1 })
    .lean();
  const data: AttachmentDTO[] = items.map((a) => ({
    id: String(a._id),
    fileName: a.fileName,
    fileUrl: a.fileUrl,
    mimeType: a.mimeType ?? null,
    fileSize: a.fileSize ?? 0,
    createdAt: a.createdAt ? new Date(a.createdAt).toISOString() : "",
  }));
  return { ok: true, data };
}
