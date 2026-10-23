import { z } from "zod";

export const createSectionSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
});

export const reorderSectionsSchema = z.object({
  orderedIds: z.array(z.string()).min(1),
});

export type CreateSectionInput = z.infer<typeof createSectionSchema>;
export type ReorderSectionsInput = z.infer<typeof reorderSectionsSchema>;
