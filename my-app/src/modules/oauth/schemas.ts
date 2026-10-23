import { z } from "zod";
import { API_KEY_SCOPES, type ApiKeyScope } from "@/models/ApiKey";

/** https always allowed; http only for the OAuth 2.1 native-app loopback carve-out. */
function isAllowedRedirectUri(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.hash) return false; // RFC 6749 §3.1.2 forbids a fragment.
  if (url.protocol === "https:") return true;
  // Node's URL keeps brackets on an IPv6 hostname ("[::1]"), not "::1".
  return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
}

export const registerClientSchema = z.object({
  redirect_uris: z
    .array(z.string())
    .min(1, "redirect_uris must be a non-empty array")
    .refine((uris) => uris.every(isAllowedRedirectUri), {
      message: "each redirect_uri must be https, or http on localhost/127.0.0.1/::1, with no fragment",
    }),
  client_name: z.string().trim().min(1).max(200).optional(),
});

export type RegisterClientInput = z.infer<typeof registerClientSchema>;

/** Space-delimited on the wire (RFC 6749 §3.3) → validated array in code. */
function parseScope(raw: string | null | undefined): ApiKeyScope[] {
  if (!raw) return ["read"];
  const requested = raw.split(" ").filter(Boolean);
  const valid = requested.filter((s): s is ApiKeyScope => (API_KEY_SCOPES as readonly string[]).includes(s));
  return valid.length > 0 ? valid : ["read"];
}

export const authorizeParamsSchema = z.object({
  response_type: z.literal("code"),
  client_id: z.string().min(1),
  redirect_uri: z.string().min(1),
  code_challenge: z.string().min(1),
  code_challenge_method: z.literal("S256"),
  scope: z.string().nullable().optional().transform(parseScope),
  state: z.string().optional(),
  resource: z.string().optional(),
});

export type AuthorizeParams = z.infer<typeof authorizeParamsSchema>;

export const authorizationCodeGrantSchema = z.object({
  grant_type: z.literal("authorization_code"),
  code: z.string().min(1),
  redirect_uri: z.string().min(1),
  client_id: z.string().min(1),
  code_verifier: z.string().min(1),
});

export const refreshTokenGrantSchema = z.object({
  grant_type: z.literal("refresh_token"),
  refresh_token: z.string().min(1),
  client_id: z.string().min(1).optional(),
});

export const tokenRequestSchema = z.discriminatedUnion("grant_type", [
  authorizationCodeGrantSchema,
  refreshTokenGrantSchema,
]);

export type AuthorizationCodeGrantInput = z.infer<typeof authorizationCodeGrantSchema>;
export type RefreshTokenGrantInput = z.infer<typeof refreshTokenGrantSchema>;
