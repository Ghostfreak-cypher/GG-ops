"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { NotificationPreference, DIGEST_FREQUENCIES } from "@/models/NotificationPreference";
import { getWorkspaceForUser } from "@/modules/workspace/server/queries";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { requireUser } from "@/modules/auth/server/session";
import type { ActionResult } from "@/lib/action-result";

const schema = z.object({
  emailDigest: z.enum(DIGEST_FREQUENCIES),
});

export async function updateNotificationPreferenceAction(
  slug: string,
  input: unknown,
): Promise<ActionResult> {
  const user = await requireUser();
  const ws = await getWorkspaceForUser(slug, user.id);
  if (!ws) return { ok: false, error: "Workspace not found." };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  await connectDB();
  await NotificationPreference.updateOne(
    {
      userId: parseObjectIdOrThrow(user.id),
      workspaceId: parseObjectIdOrThrow(ws.id),
    },
    { $set: { emailDigest: parsed.data.emailDigest } },
    { upsert: true },
  );

  revalidatePath(`/w/${slug}/settings/notifications`);
  return { ok: true };
}
