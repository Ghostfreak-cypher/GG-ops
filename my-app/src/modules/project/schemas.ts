import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  description: z.string().trim().max(500).optional(),
  color: z.string().optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
