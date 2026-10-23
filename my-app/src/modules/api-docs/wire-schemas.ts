import { z } from "zod";
import { TASK_STATUSES, TASK_PRIORITIES, TASK_TYPES } from "@/modules/task/constants";
import { WORKSPACE_ROLES, MEMBER_STATUSES } from "@/modules/workspace/roles";

/**
 * Zod mirrors of the response DTOs, for documentation only.
 *
 * Request bodies are NOT here — those come from the real validators
 * (`createTaskSchema` etc.) via `toJsonSchema`, so they cannot drift from what the API
 * actually enforces. Responses have no runtime validator to borrow: they are plain TS
 * types produced by the query layer, so the shapes below are hand-written and are the one
 * place in the spec that can fall out of sync with the code. They are transcribed from
 * `Docs/API-V1-CONTRACT.md` §"Response shapes (verbatim)"; `spec.test.ts` pins the field
 * names so a rename in a DTO surfaces as a failing test rather than a wrong spec.
 *
 * Enums are imported from the real constants, never re-typed as string literals.
 */

const isoDate = z.string().datetime().describe("ISO 8601 timestamp");
const isoDateOrNull = isoDate.nullable();
const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Mongo ObjectId");

export const currentUserSchema = z
  .object({ id: objectId, name: z.string(), email: z.string() })
  .describe("The account this credential acts as.");

export const workspaceSummarySchema = z
  .object({
    id: objectId,
    name: z.string(),
    slug: z.string().describe("URL-safe identifier — this is what path params use"),
    role: z.enum(WORKSPACE_ROLES),
  })
  .describe("A workspace the caller is an active member of.");

export const memberDtoSchema = z
  .object({
    id: objectId.describe("WorkspaceMember id (NOT the user id)"),
    userId: objectId,
    name: z.string(),
    email: z.string().describe('May be "" when the user record has no email — treat empty as absent.'),
    image: z.string().nullable(),
    jobTitle: z.string().nullable(),
    role: z.enum(WORKSPACE_ROLES),
    status: z.enum(MEMBER_STATUSES).describe("REMOVED members are excluded; INVITED are included"),
    joinedAt: isoDateOrNull,
  })
  .describe("A workspace membership row.");

export const projectSummarySchema = z
  .object({ id: objectId, name: z.string(), color: z.string().nullable() })
  .describe("A project in a workspace.");

export const taskSearchResultSchema = z
  .object({
    id: objectId,
    title: z.string(),
    description: z.string().nullable(),
    projectId: objectId,
    projectName: z.string(),
  })
  .describe("A full-text search hit. Capped at 25 results by the query layer.");

export const myTaskDtoSchema = z
  .object({
    id: objectId,
    title: z.string(),
    status: z.enum(TASK_STATUSES),
    priority: z.enum(TASK_PRIORITIES),
    dueDate: isoDateOrNull,
    completedAt: isoDateOrNull,
    labelIds: z.array(objectId).describe("Label ids only — names/colors are not resolved here"),
    projectId: objectId,
    projectName: z.string(),
  })
  .describe("A task assigned to the caller. Flat list sorted by dueDate — no OVERDUE/TODAY bucketing.");

export const taskAssigneeSchema = z.object({
  id: objectId,
  name: z.string(),
  image: z.string().nullable(),
});

export const taskDtoSchema = z
  .object({
    id: objectId,
    title: z.string(),
    description: z.string().nullable(),
    status: z.enum(TASK_STATUSES),
    priority: z.enum(TASK_PRIORITIES),
    type: z.enum(TASK_TYPES),
    sectionId: objectId.nullable(),
    position: z.number(),
    dueDate: isoDateOrNull,
    startDate: isoDateOrNull,
    assignees: z.array(taskAssigneeSchema),
    labelIds: z.array(objectId),
    commentCount: z.number().int(),
    attachmentCount: z.number().int(),
    blockedByCount: z.number().int(),
    recurrenceRule: z.string().nullable(),
    recurrenceParentId: objectId.nullable(),
  })
  .describe("A task as it appears on a board.");

export const taskDetailDtoSchema = taskDtoSchema
  .extend({
    parentTaskId: objectId.nullable(),
    labels: z.array(z.object({ id: objectId, name: z.string(), color: z.string().nullable() })),
    subtasks: z.array(taskDtoSchema),
  })
  .describe("A task with its resolved labels and subtasks.");

export const boardSectionSchema = z.object({
  id: objectId,
  name: z.string(),
  position: z.number(),
  tasks: z.array(taskDtoSchema),
});

export const boardDataSchema = z
  .object({
    projectId: objectId,
    projectName: z.string(),
    projectDescription: z.string().nullable(),
    projectColor: z.string().nullable(),
    projectIcon: z.string().nullable(),
    projectStatusColor: z.enum(["ON_TRACK", "AT_RISK", "OFF_TRACK", "ON_HOLD"]).nullable(),
    projectStatusNote: z.string().nullable(),
    projectStatusUpdatedAt: isoDateOrNull,
    memberCount: z.number().int(),
    sections: z.array(boardSectionSchema),
    unsectioned: z.array(taskDtoSchema).describe("Tasks with no section"),
  })
  .describe("A full project board.");

export const boardSummarySchema = boardDataSchema
  .pick({
    projectId: true,
    projectName: true,
    projectStatusColor: true,
    projectStatusNote: true,
    projectStatusUpdatedAt: true,
    memberCount: true,
  })
  .extend({
    taskCount: z.number().int(),
    countsByStatus: z
      .record(z.enum(TASK_STATUSES), z.number().int())
      .describe("Every status is present; a status with no tasks is 0."),
    blockedCount: z.number().int().describe("Tasks with at least one unresolved blocking dependency"),
  })
  .describe("A project's status and task counts, without task content.");

const commentAttachmentSchema = z.object({
  fileUrl: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  fileSize: z.number().int(),
});

const reactionSchema = z.object({
  emoji: z.string(),
  count: z.number().int(),
  myReaction: z.boolean().describe("Whether the calling user reacted with this emoji"),
});

/**
 * Replies nest exactly one level: `replies[].replies` is always `[]`. Expressed as a
 * concrete non-recursive shape rather than `z.lazy` so the emitted JSON Schema has no
 * `$ref` cycle — the one-level cap is a real guarantee of the query, not a simplification.
 */
const commentBaseFields = {
  id: objectId,
  body: z.string().describe("HTML (TipTap output)"),
  authorId: objectId,
  authorName: z.string(),
  authorImage: z.string().nullable(),
  createdAt: isoDate,
  parentCommentId: objectId.nullable(),
  attachments: z.array(commentAttachmentSchema),
  reactions: z.array(reactionSchema),
};

export const commentDtoSchema = z
  .object({
    ...commentBaseFields,
    replies: z
      .array(z.object({ ...commentBaseFields, replies: z.array(z.never()).max(0) }))
      .describe("Direct replies. Always one level deep."),
  })
  .describe("A root comment with its direct replies.");
