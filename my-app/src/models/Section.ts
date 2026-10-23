import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const sectionSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    name: { type: String, required: true, trim: true },
    position: { type: Number, default: 0 },
  },
  { timestamps: true },
);

sectionSchema.index({ projectId: 1, position: 1 });
sectionSchema.index({ workspaceId: 1, projectId: 1 });

export type SectionDoc = InferSchemaType<typeof sectionSchema>;

export const Section: Model<SectionDoc> =
  (models.Section as Model<SectionDoc>) || model<SectionDoc>("Section", sectionSchema);
