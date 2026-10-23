import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const taskDependencySchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    fromTaskId: { type: Schema.Types.ObjectId, ref: "Task", required: true },
    toTaskId: { type: Schema.Types.ObjectId, ref: "Task", required: true },
    type: { type: String, enum: ["BLOCKS"], default: "BLOCKS" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

taskDependencySchema.index({ workspaceId: 1, fromTaskId: 1 });
taskDependencySchema.index({ workspaceId: 1, toTaskId: 1 });
taskDependencySchema.index(
  { workspaceId: 1, fromTaskId: 1, toTaskId: 1 },
  { unique: true },
);

export type TaskDependencyDoc = InferSchemaType<typeof taskDependencySchema>;

export const TaskDependency: Model<TaskDependencyDoc> =
  (models.TaskDependency as Model<TaskDependencyDoc>) ||
  model<TaskDependencyDoc>("TaskDependency", taskDependencySchema);
