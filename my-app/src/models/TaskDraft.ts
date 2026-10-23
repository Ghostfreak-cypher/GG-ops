import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";
import { TASK_PRIORITIES } from "@/modules/task/constants";
import { DRAFT_STATUSES } from "@/modules/task-draft/constants";

/**
 * An AI-suggested task, awaiting human review. The approval gate is structural, not policy:
 * nothing in this codebase promotes a draft to a real Task except a reviewer approving it
 * through `approveDraftFor` (see modules/task-draft/server/review.ts) — there is deliberately
 * no MCP tool that could do it on an agent's behalf.
 */
const taskDraftSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    // Null until a reviewer picks one. The AI may not resolve a project with confidence;
    // approving requires setting one (see approveDraftSchema).
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null },

    title: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    priority: { type: String, enum: [...TASK_PRIORITIES], default: "MEDIUM" },
    dueDate: { type: Date, default: null },
    assigneeIds: [{ type: Schema.Types.ObjectId, ref: "User" }],

    status: { type: String, enum: [...DRAFT_STATUSES], default: "PENDING" },
    // The model's own estimate, 0-1. Shown to the reviewer as a signal, nothing more.
    confidence: { type: Number, default: null },

    // Provenance — why this draft exists, so review is a judgment call, not a rubber stamp.
    sourceMeetingId: { type: String, default: null },
    sourceMeetingTitle: { type: String, default: null },
    sourceMeetingDate: { type: String, default: null },
    sourceExcerpt: { type: String, default: null },

    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    createdTaskId: { type: Schema.Types.ObjectId, ref: "Task", default: null },
  },
  { timestamps: true },
);

// The review queue: one workspace's drafts in one status, newest first.
taskDraftSchema.index({ workspaceId: 1, status: 1, createdAt: -1 });

// Dedupe backstop: re-running the same meeting can't draft the same task twice. Scoped to
// rows that actually carry a sourceMeetingId — a plain unique index would also forbid two
// unrelated null-meeting drafts that happen to share a title.
taskDraftSchema.index(
  { workspaceId: 1, sourceMeetingId: 1, title: 1 },
  { unique: true, partialFilterExpression: { sourceMeetingId: { $type: "string" } } },
);

export type TaskDraftDoc = InferSchemaType<typeof taskDraftSchema>;

export const TaskDraft: Model<TaskDraftDoc> =
  (models.TaskDraft as Model<TaskDraftDoc>) || model<TaskDraftDoc>("TaskDraft", taskDraftSchema);
