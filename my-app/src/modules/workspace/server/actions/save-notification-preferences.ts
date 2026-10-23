"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { saveWorkspaceEmailPreferences } from "@/lib/notification-preferences";
import { requireUser } from "@/modules/auth/server/session";
import { getWorkspaceForUser } from "@/modules/workspace/server/queries";
import { WORKSPACE_EMAIL_EVENTS, WORKSPACE_EMAIL_FREQUENCIES } from "@/models/NotificationPreference";

const schema = z.object({
  updates: z.record(
    z.enum(WORKSPACE_EMAIL_EVENTS),
    z.enum(WORKSPACE_EMAIL_FREQUENCIES),
  ),
});

export async function saveNotificationPreferencesAction(
  slug: string,
  input: unknown,
): Promise<ActionResult> {
  const user = await requireUser();
  const ws = await getWorkspaceForUser(slug, user.id);
  if (!ws) return { ok: false, error: "Workspace not found." };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await saveWorkspaceEmailPreferences(user.id, ws.id, parsed.data.updates);
  return { ok: true };
}
