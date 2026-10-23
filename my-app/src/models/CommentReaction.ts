import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const commentReactionSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    commentId:   { type: Schema.Types.ObjectId, ref: "Comment",   required: true },
    userId:      { type: Schema.Types.ObjectId, ref: "User",      required: true },
    emoji:       { type: String, required: true },
  },
  { timestamps: true },
);

commentReactionSchema.index({ commentId: 1, userId: 1, emoji: 1 }, { unique: true });
commentReactionSchema.index({ workspaceId: 1, commentId: 1 });

export type CommentReactionDoc = InferSchemaType<typeof commentReactionSchema>;

export const CommentReaction: Model<CommentReactionDoc> =
  (models.CommentReaction as Model<CommentReactionDoc>) ||
  model<CommentReactionDoc>("CommentReaction", commentReactionSchema);
