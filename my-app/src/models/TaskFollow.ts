import { Schema, model, models, Types, type Model } from "mongoose";

export interface ITaskFollow {
  workspaceId: Types.ObjectId;
  taskId: Types.ObjectId;
  userId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const taskFollowSchema = new Schema<ITaskFollow>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

taskFollowSchema.index({ workspaceId: 1, taskId: 1 });
taskFollowSchema.index({ taskId: 1, userId: 1 }, { unique: true });

export const TaskFollow =
  (models.TaskFollow as Model<ITaskFollow>) ||
  model<ITaskFollow>("TaskFollow", taskFollowSchema);
