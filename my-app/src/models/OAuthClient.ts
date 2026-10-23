import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

/**
 * A dynamically-registered OAuth client (RFC 7591) — e.g. claude.ai or Gemini's
 * "connect an MCP server" flow. Public clients only: no `client_secret` field
 * exists, because there is nowhere safe for a browser-driven connector to keep one.
 * `token_endpoint_auth_method` is always "none" in every response we send.
 */
const oauthClientSchema = new Schema(
  {
    // `unique` already creates the index - don't add `index: true`.
    clientId: { type: String, required: true, unique: true },
    clientName: { type: String, required: true, trim: true },
    redirectUris: { type: [String], required: true },
  },
  { timestamps: true },
);

export type OAuthClientDoc = InferSchemaType<typeof oauthClientSchema>;

export const OAuthClient: Model<OAuthClientDoc> =
  (models.OAuthClient as Model<OAuthClientDoc>) ||
  model<OAuthClientDoc>("OAuthClient", oauthClientSchema);
