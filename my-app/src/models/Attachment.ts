import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const attachmentSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    taskId: { type: Schema.Types.ObjectId, ref: "Task", default: null },
    commentId: { type: Schema.Types.ObjectId, ref: "Comment", default: null },
    reportId: { type: Schema.Types.ObjectId, ref: "SpendReport", default: null },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    fileName: { type: String, required: true },
    fileUrl: { type: String, required: true },
    mimeType: { type: String, default: null },
    fileSize: { type: Number, default: 0 },
    storageKey: { type: String, default: null },
  },
  { timestamps: true },
);

attachmentSchema.index({ taskId: 1, createdAt: -1 });
attachmentSchema.index({ commentId: 1, createdAt: -1 });
attachmentSchema.index({ reportId: 1, createdAt: -1 });
attachmentSchema.index({ workspaceId: 1 });

export type AttachmentDoc = InferSchemaType<typeof attachmentSchema>;

export const Attachment: Model<AttachmentDoc> =
  (models.Attachment as Model<AttachmentDoc>) ||
  model<AttachmentDoc>("Attachment", attachmentSchema);
