"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { ApiKey } from "@/models/ApiKey";
import { requireUser } from "@/modules/auth/server/session";
import { revokeGrantForApiKey } from "@/modules/oauth/server/actions/revoke-grant";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import type { ActionResult } from "@/lib/action-result";

export async function revokeApiKeyAction(keyId: string): Promise<ActionResult> {
  const user = await requireUser();

  await connectDB();
  const id = parseObjectIdOrThrow(keyId);
  // Scope the update to the caller's own key — never trust the client-sent id alone.
  const result = await ApiKey.updateOne(
    { _id: id, userId: parseObjectIdOrThrow(user.id), revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
  if (result.matchedCount === 0) return { ok: false, error: "Key not found." };

  // OAuth-issued keys also have refresh capability sitting on an OAuthGrant — revoking
  // just the access token here isn't enough, or the client mints a new one on its next
  // refresh. No-op for ordinary PATs, which have no grant to find.
  await revokeGrantForApiKey(keyId);

  revalidatePath("/account/api-keys");
  return { ok: true };
}
