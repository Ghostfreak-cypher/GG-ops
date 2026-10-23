import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

/**
 * One document per OAuth authorization grant, evolving through its whole lifecycle
 * rather than living in separate code/refresh-token tables: created at consent time
 * holding the auth code, then mutated in place into a refresh-token record on first
 * exchange, then rotated in place on every subsequent refresh.
 *
 * IMPORTANT: do not add a TTL index on `codeExpiresAt`. Once a code is exchanged this
 * document becomes the live refresh-token record — a TTL index on the now-stale
 * `codeExpiresAt` would delete every successful grant ~60s after it was created.
 */
const oauthGrantSchema = new Schema(
  {
    clientId: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    redirectUri: { type: String, required: true },
    codeChallenge: { type: String, required: true },
    scopes: { type: [String], required: true },

    // `unique` already creates the index - don't add `index: true`.
    codeHash: { type: String, required: true, unique: true },
    codeExpiresAt: { type: Date, required: true },
    codeConsumedAt: { type: Date, default: null },

    // Left unset (not defaulted to null) until the code is first exchanged, so the
    // sparse unique index only ever enforces uniqueness across grants that reached
    // refresh-token phase — two still-pending grants both "having no value" must not
    // collide.
    refreshTokenHash: { type: String },
    refreshExpiresAt: { type: Date },

    // Reuse-detection: the hash just replaced by the latest rotation. A client
    // presenting this value means a refresh token was stolen and raced — revoke the
    // whole grant immediately rather than treating it as an ordinary invalid token.
    previousRefreshTokenHash: { type: String },

    latestApiKeyId: { type: Schema.Types.ObjectId, ref: "ApiKey", default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

oauthGrantSchema.index({ refreshTokenHash: 1 }, { unique: true, sparse: true });
oauthGrantSchema.index({ previousRefreshTokenHash: 1 }, { sparse: true });
oauthGrantSchema.index({ latestApiKeyId: 1 });

export type OAuthGrantDoc = InferSchemaType<typeof oauthGrantSchema>;

export const OAuthGrant: Model<OAuthGrantDoc> =
  (models.OAuthGrant as Model<OAuthGrantDoc>) ||
  model<OAuthGrantDoc>("OAuthGrant", oauthGrantSchema);
