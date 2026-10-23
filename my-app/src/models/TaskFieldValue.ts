import { Schema, model, models, type Model } from "mongoose";

export interface ITaskFieldValue {
  _id: unknown;
  workspaceId: unknown;
  taskId: unknown;
  fieldId: unknown;
  value: string | number | null;
  createdAt: Date;
  updatedAt: Date;
}

const TaskFieldValueSchema = new Schema<ITaskFieldValue>(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true, ref: "Workspace" },
    taskId: { type: Schema.Types.ObjectId, required: true, ref: "Task" },
    fieldId: { type: Schema.Types.ObjectId, required: true, ref: "CustomField" },
    value: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

TaskFieldValueSchema.index({ taskId: 1, fieldId: 1 }, { unique: true });
TaskFieldValueSchema.index({ workspaceId: 1, taskId: 1 });

export const TaskFieldValue =
  (models.TaskFieldValue as Model<ITaskFieldValue>) ||
  model<ITaskFieldValue>("TaskFieldValue", TaskFieldValueSchema);
