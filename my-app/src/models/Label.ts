import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const labelSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    name: { type: String, required: true, trim: true },
    color: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

labelSchema.index({ workspaceId: 1, name: 1 });

export type LabelDoc = InferSchemaType<typeof labelSchema>;

export const Label: Model<LabelDoc> =
  (models.Label as Model<LabelDoc>) || model<LabelDoc>("Label", labelSchema);
