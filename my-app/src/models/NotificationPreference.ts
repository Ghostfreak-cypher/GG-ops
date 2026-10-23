import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

export const DIGEST_FREQUENCIES = ["DAILY", "WEEKLY", "NONE"] as const;
export type DigestFrequency = (typeof DIGEST_FREQUENCIES)[number];

export const WORKSPACE_EMAIL_EVENTS = [
  "INVITE",
  "WORKSPACE_JOINED",
  "ROLE_UPDATED",
  "TASK_ASSIGNED",
  "TASK_DUE",
  "TASK_DUE_TOMORROW",
  "TASK_OVERDUE",
  "TASK_COMPLETED",
  "TASK_COMMENTED",
  "COMMENT_MENTION",
  "MEMBER_JOINED",
  "DIGEST_DAILY",
  "DIGEST_WEEKLY",
] as const;

export const WORKSPACE_EMAIL_FREQUENCIES = ["OFF", "IMMEDIATE", "DAILY", "WEEKLY"] as const;

const preferenceItemSchema = new Schema(
  {
    event: { type: String, enum: [...WORKSPACE_EMAIL_EVENTS], required: true },
    frequency: { type: String, enum: [...WORKSPACE_EMAIL_FREQUENCIES], required: true },
  },
  { _id: false },
);

const notificationPreferenceSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    emailDigest: { type: String, enum: [...DIGEST_FREQUENCIES], default: "DAILY" },
    preferences: { type: [preferenceItemSchema], default: [] },
  },
  { timestamps: true },
);

notificationPreferenceSchema.index({ userId: 1, workspaceId: 1 }, { unique: true });

export type NotificationPreferenceDoc = InferSchemaType<typeof notificationPreferenceSchema>;

export const NotificationPreference: Model<NotificationPreferenceDoc> =
  (models.NotificationPreference as Model<NotificationPreferenceDoc>) ||
  model<NotificationPreferenceDoc>("NotificationPreference", notificationPreferenceSchema);
