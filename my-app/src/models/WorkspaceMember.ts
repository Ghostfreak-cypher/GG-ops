import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";
import { WORKSPACE_ROLES, MEMBER_STATUSES } from "@/modules/workspace/roles";

const workspaceMemberSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: { type: String, enum: [...WORKSPACE_ROLES], default: "MEMBER" },
    status: { type: String, enum: [...MEMBER_STATUSES], default: "ACTIVE" },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    joinedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// One membership per (workspace, user). Compound indexes cover workspaceId-prefixed reads.
workspaceMemberSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
workspaceMemberSchema.index({ workspaceId: 1, role: 1 });

export type WorkspaceMemberDoc = InferSchemaType<typeof workspaceMemberSchema>;

export const WorkspaceMember: Model<WorkspaceMemberDoc> =
  (models.WorkspaceMember as Model<WorkspaceMemberDoc>) ||
  model<WorkspaceMemberDoc>("WorkspaceMember", workspaceMemberSchema);
