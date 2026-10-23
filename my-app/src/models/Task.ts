import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";
import { TASK_STATUSES, TASK_PRIORITIES, TASK_TYPES } from "@/modules/task/constants";

const taskSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    sectionId: { type: Schema.Types.ObjectId, ref: "Section", default: null },
    parentTaskId: { type: Schema.Types.ObjectId, ref: "Task", default: null },

    title: { type: String, required: true, trim: true },
    description: { type: String, default: null },

    status: { type: String, enum: [...TASK_STATUSES], default: "TODO" },
    priority: { type: String, enum: [...TASK_PRIORITIES], default: "MEDIUM" },
    type: { type: String, enum: [...TASK_TYPES], default: "TASK" },

    assigneeIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    labelIds: [{ type: Schema.Types.ObjectId, ref: "Label" }],

    dueDate: { type: Date, default: null },
    startDate: { type: Date, default: null },
    completedAt: { type: Date, default: null },

    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },

    isArchived: { type: Boolean, default: false },
    position: { type: Number, default: 0 },

    recurrenceRule: {
      type: String,
      enum: ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"],
      default: null,
    },
    recurrenceParentId: { type: Schema.Types.ObjectId, ref: "Task", default: null },
  },
  { timestamps: true },
);

// Board fetch, my-tasks, project listing, subtasks.
taskSchema.index({ projectId: 1, sectionId: 1, position: 1 });
taskSchema.index({ workspaceId: 1, assigneeIds: 1, dueDate: 1 });
taskSchema.index({ workspaceId: 1, projectId: 1, isArchived: 1 });
taskSchema.index({ parentTaskId: 1 });
// Workspace-scoped full-text search — title weighted 10× over description.
taskSchema.index(
  { workspaceId: 1, title: "text", description: "text" },
  { weights: { title: 10, description: 1 } },
);
taskSchema.index({ workspaceId: 1, recurrenceRule: 1 });
// getMyTasks (home/my-tasks/calendar) filters {workspaceId,assigneeIds,isArchived} and sorts
// {dueDate,updatedAt}; the existing {workspaceId,assigneeIds,dueDate} index stops short of
// that sort and forces an in-memory SORT stage. NOTE: assigneeIds is multikey, so whether
// Mongo actually drops the SORT stage should be confirmed with explain() before relying on
// it — keep this index only if it does.
taskSchema.index({ workspaceId: 1, assigneeIds: 1, isArchived: 1, dueDate: 1, updatedAt: -1 });
// Covers both dashboard countDocuments shapes ({isArchived,status:{$ne:"DONE"},dueDate:{$lt}}
// and {status:"DONE",completedAt:{$gte}}) plus the workspace-dashboard $group-by-projectId
// aggregate as index-only scans, in place of three separately-shaped indexes.
taskSchema.index({ workspaceId: 1, isArchived: 1, status: 1, dueDate: 1, projectId: 1 });

export type TaskDoc = InferSchemaType<typeof taskSchema>;

export const Task: Model<TaskDoc> =
  (models.Task as Model<TaskDoc>) || model<TaskDoc>("Task", taskSchema);
