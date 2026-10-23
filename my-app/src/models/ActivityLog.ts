import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

export const ACTIVITY_ENTITY_TYPES = [
  "TASK",
  "PROJECT",
  "COMMENT",
  "SECTION",
  "WORKSPACE",
] as const;

const activityLogSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    taskId: { type: Schema.Types.ObjectId, ref: "Task", default: null },
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    entityType: { type: String, enum: [...ACTIVITY_ENTITY_TYPES], required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    action: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

activityLogSchema.index({ taskId: 1, createdAt: -1 });
activityLogSchema.index({ workspaceId: 1, createdAt: -1 });
activityLogSchema.index({ projectId: 1, createdAt: -1 });

export type ActivityLogDoc = InferSchemaType<typeof activityLogSchema>;

export const ActivityLog: Model<ActivityLogDoc> =
  (models.ActivityLog as Model<ActivityLogDoc>) ||
  model<ActivityLogDoc>("ActivityLog", activityLogSchema);
