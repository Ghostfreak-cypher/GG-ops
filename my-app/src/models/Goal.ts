import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

export const GOAL_STATUSES = ["ON_TRACK", "AT_RISK", "OFF_TRACK", "COMPLETED", "MISSED"] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

const goalSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    status: { type: String, enum: [...GOAL_STATUSES], default: "ON_TRACK" },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    parentGoalId: { type: Schema.Types.ObjectId, ref: "Goal", default: null },
    linkedProjectIds: [{ type: Schema.Types.ObjectId, ref: "Project" }],
    linkedTaskIds: [{ type: Schema.Types.ObjectId, ref: "Task" }],
    period: { type: String, default: null },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    teamLabel: { type: String, default: null },
    dueDate: { type: Date, default: null },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true },
);

goalSchema.index({ workspaceId: 1, parentGoalId: 1 });
goalSchema.index({ workspaceId: 1, status: 1 });
goalSchema.index({ workspaceId: 1, period: 1 });

export type GoalDoc = InferSchemaType<typeof goalSchema>;

export const Goal: Model<GoalDoc> =
  (models.Goal as Model<GoalDoc>) || model<GoalDoc>("Goal", goalSchema);
