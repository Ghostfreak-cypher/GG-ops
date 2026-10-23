import { z } from "zod";

export const createAttachmentSchema = z.object({
  fileName: z.string().trim().min(1, "File name is required").max(200),
  fileUrl: z.url(),
  mimeType: z.string().trim().max(120).optional(),
  fileSize: z.number().int().nonnegative().optional(),
  storageKey: z.string().trim().max(500).optional(),
});

export type CreateAttachmentInput = z.infer<typeof createAttachmentSchema>;
