import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const workspaceInviteSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: ["ADMIN", "MEMBER", "GUEST"], default: "MEMBER" },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // `unique` creates the index; don't also set `index: true`.
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

workspaceInviteSchema.index({ workspaceId: 1, email: 1 });

export type WorkspaceInviteDoc = InferSchemaType<typeof workspaceInviteSchema>;

export const WorkspaceInvite: Model<WorkspaceInviteDoc> =
  (models.WorkspaceInvite as Model<WorkspaceInviteDoc>) ||
  model<WorkspaceInviteDoc>("WorkspaceInvite", workspaceInviteSchema);
