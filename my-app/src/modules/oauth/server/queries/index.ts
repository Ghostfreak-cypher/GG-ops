import { connectDB } from "@/lib/db";
import { OAuthClient } from "@/models/OAuthClient";

export type OAuthClientSummary = { clientId: string; clientName: string; redirectUris: string[] };

export async function getClientByClientId(clientId: string): Promise<OAuthClientSummary | null> {
  await connectDB();
  const client = await OAuthClient.findOne({ clientId })
    .select("clientId clientName redirectUris")
    .lean();
  if (!client) return null;
  return { clientId: client.clientId, clientName: client.clientName, redirectUris: client.redirectUris };
}
