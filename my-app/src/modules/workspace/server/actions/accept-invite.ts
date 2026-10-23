"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth/server/session";
import { rateLimit } from "@/lib/rate-limit";
import { joinWorkspaceViaInvite } from "@/modules/workspace/server/actions/join-via-invite";
import type { ActionResult } from "@/lib/action-result";

export async function acceptInviteAction(token: string): Promise<ActionResult> {
  const user = await requireUser();

  const limited = await rateLimit(`accept-invite:${user.id}`, 20, 3600);
  if (!limited.allowed) {
    return { ok: false, error: "Too many invite attempts. Try again later." };
  }

  const result = await joinWorkspaceViaInvite({
    token,
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
  });
  if (!result.ok) return { ok: false, error: result.error };

  redirect(`/w/${result.slug}`);
}
