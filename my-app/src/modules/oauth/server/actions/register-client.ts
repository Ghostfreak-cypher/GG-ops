import { randomBytes } from "node:crypto";
import { connectDB } from "@/lib/db";
import { OAuthClient } from "@/models/OAuthClient";
import { registerClientSchema } from "@/modules/oauth/schemas";
import type { OAuthResult } from "@/lib/oauth-response";

export type RegisteredClient = {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
  token_endpoint_auth_method: "none";
  grant_types: ["authorization_code", "refresh_token"];
  response_types: ["code"];
  client_id_issued_at: number;
};

/**
 * RFC 7591 dynamic client registration. Public, unauthenticated (rate-limited by the
 * caller) — capabilities in the response are always the same fixed set regardless of
 * what was requested; there is no negotiation surface to get wrong.
 */
export async function registerClient(input: unknown): Promise<OAuthResult<RegisteredClient>> {
  const parsed = registerClientSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_client_metadata", description: parsed.error.issues[0]?.message };
  }

  await connectDB();
  const clientId = `mcp_${randomBytes(16).toString("base64url")}`;
  const client = await OAuthClient.create({
    clientId,
    clientName: parsed.data.client_name ?? "Unnamed client",
    redirectUris: parsed.data.redirect_uris,
  });

  return {
    ok: true,
    data: {
      client_id: client.clientId,
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      client_id_issued_at: Math.floor(client.get("createdAt").getTime() / 1000),
    },
  };
}
