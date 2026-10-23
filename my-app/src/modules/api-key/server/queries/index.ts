import { connectDB } from "@/lib/db";
import { ApiKey, type ApiKeyScope } from "@/models/ApiKey";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";

export type ApiKeyDTO = {
  id: string;
  name: string;
  prefix: string;
  scopes: ApiKeyScope[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

/** Never selects `tokenHash` — the list view has no reason to touch it. */
export async function listApiKeys(userId: string): Promise<ApiKeyDTO[]> {
  await connectDB();
  const keys = await ApiKey.find({ userId: parseObjectIdOrThrow(userId), revokedAt: null })
    .select("_id name prefix scopes lastUsedAt expiresAt createdAt")
    .sort({ createdAt: -1 })
    .lean();

  return keys.map((key) => ({
    id: String(key._id),
    name: key.name,
    prefix: key.prefix,
    scopes: key.scopes as ApiKeyScope[],
    lastUsedAt: key.lastUsedAt ? key.lastUsedAt.toISOString() : null,
    expiresAt: key.expiresAt ? key.expiresAt.toISOString() : null,
    createdAt: key.createdAt ? new Date(key.createdAt).toISOString() : "",
  }));
}
