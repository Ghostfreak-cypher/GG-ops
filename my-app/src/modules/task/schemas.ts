import { z } from "zod";
import { TASK_STATUSES, TASK_PRIORITIES, TASK_TYPES } from "@/modules/task/constants";

// Accept an explicit null (clear the date) or an ISO string/Date (coerced).
const dueDate = z.union([z.null(), z.coerce.date()]).optional();
const startDate = z.union([z.null(), z.coerce.date()]).optional();

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(300),
  description: z.string().optional(),
  sectionId: z.string().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  type: z.enum(TASK_TYPES).optional(),
  dueDate,
  startDate,
  assigneeIds: z.array(z.string()).optional(),
  labelIds: z.array(z.string()).optional(),
  parentTaskId: z.string().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  type: z.enum(TASK_TYPES).optional(),
  dueDate,
  startDate,
  assigneeIds: z.array(z.string()).optional(),
  labelIds: z.array(z.string()).optional(),
  sectionId: z.string().nullable().optional(),
  recurrenceRule: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]).nullable().optional(),
});

export const moveTaskSchema = z.object({
  destSectionId: z.string().nullable(),
  orderedIds: z.array(z.string()).min(1),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;
