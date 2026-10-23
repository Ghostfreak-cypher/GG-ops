import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

export const NOTIFICATION_TYPES = [
  "TASK_ASSIGNED",
  "COMMENT_MENTION",
  "TASK_DUE",
  "TASK_DUE_TOMORROW",
  "TASK_OVERDUE",
  "TASK_COMPLETED",
  "TASK_COMMENTED",
  "INVITE",
  "MEMBER_JOINED",
  "ROLE_UPDATED",
  "WORKSPACE_JOINED",
] as const;

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    type: { type: String, enum: [...NOTIFICATION_TYPES], required: true },
    title: { type: String, required: true },
    body: { type: String, default: null },
    entityType: { type: String, default: null },
    entityId: { type: Schema.Types.ObjectId, default: null },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ workspaceId: 1, userId: 1 });
// The inbox list filters {userId} only and sorts {createdAt:-1} — the index above puts
// isRead ahead of createdAt in the key, so without an isRead predicate it can't serve that
// sort and forces a blocking in-memory SORT over the user's whole notification history.
notificationSchema.index({ userId: 1, createdAt: -1 });

export type NotificationDoc = InferSchemaType<typeof notificationSchema>;

export const Notification: Model<NotificationDoc> =
  (models.Notification as Model<NotificationDoc>) ||
  model<NotificationDoc>("Notification", notificationSchema);
