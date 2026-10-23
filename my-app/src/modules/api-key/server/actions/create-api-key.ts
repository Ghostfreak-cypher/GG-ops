"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { mintApiKey } from "@/lib/api-key";
import { ApiKey } from "@/models/ApiKey";
import { createApiKeySchema } from "@/modules/api-key/schemas";
import { requireUser } from "@/modules/auth/server/session";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import type { ActionResult } from "@/lib/action-result";

type CreatedKey = { id: string; token: string; prefix: string };

/** The plaintext `token` is only ever present in this one response — never stored, never re-shown. */
export async function createApiKeyAction(input: unknown): Promise<ActionResult<CreatedKey>> {
  const user = await requireUser();

  const parsed = createApiKeySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { name, scopes, expiresInDays } = parsed.data;

  await connectDB();
  const { token, tokenHash, prefix } = mintApiKey();
  const key = await ApiKey.create({
    userId: parseObjectIdOrThrow(user.id),
    name,
    tokenHash,
    prefix,
    kind: "PAT",
    scopes,
    authVersion: user.authVersion,
    expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null,
  });

  revalidatePath("/account/api-keys");
  return { ok: true, data: { id: String(key._id), token, prefix } };
}
