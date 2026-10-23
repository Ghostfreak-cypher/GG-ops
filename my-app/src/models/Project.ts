import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const projectSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    name: { type: String, required: true, trim: true },
    key: { type: String, default: null },
    description: { type: String, default: null },
    color: { type: String, default: null },
    icon: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    archivedAt: { type: Date, default: null },
    statusColor: {
      type: String,
      enum: ["ON_TRACK", "AT_RISK", "OFF_TRACK", "ON_HOLD"],
      default: null,
    },
    statusNote: { type: String, default: null },
    statusUpdatedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

projectSchema.index({ workspaceId: 1, archivedAt: 1 });
projectSchema.index({ workspaceId: 1, name: 1 });

export type ProjectDoc = InferSchemaType<typeof projectSchema>;

export const Project: Model<ProjectDoc> =
  (models.Project as Model<ProjectDoc>) || model<ProjectDoc>("Project", projectSchema);
