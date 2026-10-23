import { cache } from "react";
import { connectDB } from "@/lib/db";
import { Attachment } from "@/models/Attachment";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";

export type AttachmentDTO = {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  fileSize: number;
  createdAt: string;
};

/** Attachments on a task, newest first. Call from access-verified contexts. */
export const listAttachments = cache(async (taskId: string): Promise<AttachmentDTO[]> => {
  await connectDB();
  const items = await Attachment.find({ taskId: parseObjectIdOrThrow(taskId) })
    .sort({ createdAt: -1 })
    .lean();
  return items.map((a) => ({
    id: String(a._id),
    fileName: a.fileName,
    fileUrl: a.fileUrl,
    mimeType: a.mimeType ?? null,
    fileSize: a.fileSize ?? 0,
    createdAt: a.createdAt ? new Date(a.createdAt).toISOString() : "",
  }));
});
