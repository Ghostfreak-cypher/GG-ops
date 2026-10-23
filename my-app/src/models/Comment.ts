import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const commentSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true },
    mentionedUserIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    parentCommentId: { type: Schema.Types.ObjectId, ref: "Comment", default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

commentSchema.index({ taskId: 1, createdAt: 1 });
commentSchema.index({ workspaceId: 1, authorId: 1 });

export type CommentDoc = InferSchemaType<typeof commentSchema>;

export const Comment: Model<CommentDoc> =
  (models.Comment as Model<CommentDoc>) || model<CommentDoc>("Comment", commentSchema);
