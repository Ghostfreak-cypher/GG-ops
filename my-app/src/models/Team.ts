import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const teamSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    color: { type: String, default: "#000000" },
    isPrivate: { type: Boolean, default: false },
    memberIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    leadIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

teamSchema.index({ workspaceId: 1, name: 1 });

export type TeamDoc = InferSchemaType<typeof teamSchema>;

export const Team: Model<TeamDoc> =
  (models.Team as Model<TeamDoc>) || model<TeamDoc>("Team", teamSchema);
