import { z } from "zod";

export const createLabelSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(40),
  color: z.string().optional(),
});

export type CreateLabelInput = z.infer<typeof createLabelSchema>;
