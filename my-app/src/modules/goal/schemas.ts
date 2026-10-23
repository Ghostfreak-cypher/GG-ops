import { z } from "zod";
import { GOAL_STATUSES } from "./constants";

export const createGoalSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).optional(),
  status: z.enum(GOAL_STATUSES).default("ON_TRACK"),
  progress: z.number().min(0).max(100).default(0),
  parentGoalId: z.string().optional(),
  period: z.string().max(50).optional(),
  teamLabel: z.string().max(100).optional(),
  dueDate: z.string().datetime({ offset: true }).optional(),
});

export const updateGoalSchema = createGoalSchema.partial();

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
