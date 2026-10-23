import { z } from "zod";
import { GOAL_STATUSES } from "./constants";

const goalSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).optional(),
  status: z.enum(GOAL_STATUSES),
  progress: z.number().min(0).max(100),
  parentGoalId: z.string().optional(),
  period: z.string().max(50).optional(),
  teamLabel: z.string().max(100).optional(),
  dueDate: z.string().datetime({ offset: true }).optional(),
});

export const createGoalSchema = goalSchema.extend({
  status: goalSchema.shape.status.default("ON_TRACK"),
  progress: goalSchema.shape.progress.default(0),
});

// From the default-free base on purpose: `.partial()` keeps inner `.default()`s, so deriving
// this from createGoalSchema made every rename reset status to ON_TRACK and progress to 0.
export const updateGoalSchema = goalSchema.partial();

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
