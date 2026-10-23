import { z } from "zod";

const attachmentInputSchema = z.object({
  fileName: z.string().min(1).max(200),
  fileUrl: z.string().url(),
  mimeType: z.string().max(120).optional(),
  fileSize: z.number().int().nonnegative().optional(),
  storageKey: z.string().max(500).optional(),
});

export type AttachmentInput = z.infer<typeof attachmentInputSchema>;

export const createCommentSchema = z.object({
  body: z.string().trim().min(1, "Comment can't be empty").max(5000),
  attachments: z.array(attachmentInputSchema).max(10).optional(),
  parentCommentId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
