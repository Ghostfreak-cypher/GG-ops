import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

export const AUTH_TOKEN_TYPES = ["PASSWORD_RESET", "EMAIL_VERIFY"] as const;

const authTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: [...AUTH_TOKEN_TYPES], required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

authTokenSchema.index({ userId: 1, type: 1, consumedAt: 1, expiresAt: 1 });

export type AuthTokenDoc = InferSchemaType<typeof authTokenSchema>;

export const AuthToken: Model<AuthTokenDoc> =
  (models.AuthToken as Model<AuthTokenDoc>) || model<AuthTokenDoc>("AuthToken", authTokenSchema);
