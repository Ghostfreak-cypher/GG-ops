import { z } from "zod";
import { TASK_PRIORITIES } from "@/modules/task/constants";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const dateKey = z.string().regex(DATE_KEY_RE, "Date must be YYYY-MM-DD");

/**
 * What `create_task_draft` accepts. Mirrors `createTaskSchema`'s field set minus
 * sectionId/labelIds/type — a draft doesn't commit to those until a human approves it —
 * plus the meeting provenance that lets a reviewer judge the suggestion instead of
 * rubber-stamping it.
 */
export const createDraftSchema = z.object({
  projectId: z.string().optional(),
  title: z.string().trim().min(1, "Title is required").max(300),
  description: z.string().max(4000).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  dueDate: z.union([z.null(), dateKey]).optional(),
  assigneeIds: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).optional(),
  sourceMeetingId: z.string().trim().max(200).optional(),
  sourceMeetingTitle: z.string().trim().max(300).optional(),
  sourceMeetingDate: dateKey.optional(),
  sourceExcerpt: z.string().trim().max(1000).optional(),
});
export type CreateDraftInput = z.infer<typeof createDraftSchema>;

/**
 * The reviewer's edited values, submitted together with Approve. There is no
 * save-without-approving path — Approve carries the edits, Reject discards them.
 * Unlike the create side, `projectId` is required: a draft can't become a task without one.
 */
export const approveDraftSchema = z.object({
  projectId: z.string().min(1, "Choose a project"),
  title: z.string().trim().min(1, "Title is required").max(300),
  description: z.string().max(4000).optional(),
  priority: z.enum(TASK_PRIORITIES),
  dueDate: z.union([z.null(), dateKey]).optional(),
  assigneeIds: z.array(z.string()).optional(),
});
export type ApproveDraftInput = z.infer<typeof approveDraftSchema>;
