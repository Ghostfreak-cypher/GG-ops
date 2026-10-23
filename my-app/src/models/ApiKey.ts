import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

export const API_KEY_KINDS = ["PAT", "OAUTH"] as const;
export const API_KEY_SCOPES = ["read", "write"] as const;
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

const apiKeySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true },
    // `unique` already creates the index - don't add `index: true`.
    tokenHash: { type: String, required: true, unique: true },
    /** First few chars of the plaintext, for display only ("ggops_sk_a1b2c3…"). */
    prefix: { type: String, required: true },
    kind: { type: String, enum: [...API_KEY_KINDS], default: "PAT" },
    /** Set for OAUTH keys; identifies the registered client the token was issued to. */
    clientId: { type: String, default: null },
    scopes: { type: [String], enum: [...API_KEY_SCOPES], default: ["read"] },
    /**
     * The owner's `User.authVersion` at issue time. Compared on every request so a
     * password change / forced logout revokes agent keys exactly like it revokes JWTs.
     */
    authVersion: { type: Number, required: true },
    lastUsedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

apiKeySchema.index({ userId: 1, revokedAt: 1 });

export type ApiKeyDoc = InferSchemaType<typeof apiKeySchema>;

export const ApiKey: Model<ApiKeyDoc> =
  (models.ApiKey as Model<ApiKeyDoc>) || model<ApiKeyDoc>("ApiKey", apiKeySchema);
