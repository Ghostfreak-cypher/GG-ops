import { Schema, model, models, type Model } from "mongoose";

export type CustomFieldType = "TEXT" | "NUMBER" | "SELECT" | "DATE";

export interface ICustomFieldOption {
  id: string;
  label: string;
  color: string | null;
}

export interface ICustomField {
  _id: unknown;
  workspaceId: unknown;
  projectId: unknown;
  name: string;
  type: CustomFieldType;
  options: ICustomFieldOption[];
  position: number;
  createdBy: unknown;
  createdAt: Date;
  updatedAt: Date;
}

const OptionSchema = new Schema<ICustomFieldOption>(
  {
    id: { type: String, required: true },
    label: { type: String, required: true, maxlength: 80 },
    color: { type: String, default: null },
  },
  { _id: false },
);

const CustomFieldSchema = new Schema<ICustomField>(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true, ref: "Workspace" },
    projectId: { type: Schema.Types.ObjectId, required: true, ref: "Project" },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    type: { type: String, enum: ["TEXT", "NUMBER", "SELECT", "DATE"], required: true },
    options: { type: [OptionSchema], default: [] },
    position: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
  },
  { timestamps: true },
);

CustomFieldSchema.index({ workspaceId: 1, projectId: 1, position: 1 });

export const CustomField =
  (models.CustomField as Model<ICustomField>) ||
  model<ICustomField>("CustomField", CustomFieldSchema);
