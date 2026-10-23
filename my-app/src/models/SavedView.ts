import { Schema, model, models, type Model } from "mongoose";

export interface ISavedView {
  _id: unknown;
  workspaceId: unknown;
  projectId: unknown;
  createdBy: unknown;
  name: string;
  filters: {
    statuses: string[];
    priorities: string[];
    assigneeIds: string[];
    labelIds: string[];
    dueDateFrom: string | null;
    dueDateTo: string | null;
  };
  sortBy: string;
  sortDir: "asc" | "desc";
  groupBy: string;
  showCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SavedViewSchema = new Schema<ISavedView>(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true, ref: "Workspace" },
    projectId: { type: Schema.Types.ObjectId, required: true, ref: "Project" },
    createdBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    filters: {
      statuses: { type: [String], default: [] },
      priorities: { type: [String], default: [] },
      assigneeIds: { type: [String], default: [] },
      labelIds: { type: [String], default: [] },
      dueDateFrom: { type: String, default: null },
      dueDateTo: { type: String, default: null },
    },
    sortBy: { type: String, default: "title" },
    sortDir: { type: String, enum: ["asc", "desc"], default: "asc" },
    groupBy: { type: String, default: "section" },
    showCompleted: { type: Boolean, default: true },
  },
  { timestamps: true },
);

SavedViewSchema.index({ workspaceId: 1, projectId: 1 });
SavedViewSchema.index({ workspaceId: 1, projectId: 1, createdBy: 1 });

export const SavedView =
  (models.SavedView as Model<ISavedView>) || model<ISavedView>("SavedView", SavedViewSchema);
