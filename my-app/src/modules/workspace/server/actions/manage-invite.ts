"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { WorkspaceInvite } from "@/models/WorkspaceInvite";
import { canInviteMembers } from "@/modules/workspace/server/permissions";
import { getWorkspaceForUser } from "@/modules/workspace/server/queries";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { requireUser } from "@/modules/auth/server/session";
import { generateInviteToken, inviteExpiry } from "@/modules/workspace/invites";
import { enqueueAndDispatch } from "@/lib/queue";
import { absoluteUrl } from "@/lib/urls";
import type { ActionResult } from "@/lib/action-result";

const idSchema = z.object({ inviteId: z.string() });

export async function revokeInviteAction(
  slug: string,
  input: unknown,
): Promise<ActionResult> {
  const user = await requireUser();

  const ws = await getWorkspaceForUser(slug, user.id);
  if (!ws) return { ok: false, error: "Workspace not found." };
  if (!canInviteMembers(ws.role)) {
    return { ok: false, error: "Insufficient permissions." };
  }

  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  await connectDB();
  const workspaceId = parseObjectIdOrThrow(ws.id);
  const inviteId = parseObjectIdOrThrow(parsed.data.inviteId);

  const invite = await WorkspaceInvite.findOne({ _id: inviteId, workspaceId, acceptedAt: null }).lean();
  if (!invite) return { ok: false, error: "Invite not found." };

  await WorkspaceInvite.deleteOne({ _id: inviteId });

  revalidatePath(`/w/${slug}/members`);
  return { ok: true };
}

export async function resendInviteAction(
  slug: string,
  input: unknown,
): Promise<ActionResult<{ inviteUrl: string }>> {
  const user = await requireUser();

  const ws = await getWorkspaceForUser(slug, user.id);
  if (!ws) return { ok: false, error: "Workspace not found." };
  if (!canInviteMembers(ws.role)) {
    return { ok: false, error: "Insufficient permissions." };
  }

  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  await connectDB();
  const workspaceId = parseObjectIdOrThrow(ws.id);
  const inviteId = parseObjectIdOrThrow(parsed.data.inviteId);

  const invite = await WorkspaceInvite.findOne({ _id: inviteId, workspaceId, acceptedAt: null }).lean();
  if (!invite) return { ok: false, error: "Invite not found." };

  // Issue a fresh token + expiry
  const newToken = generateInviteToken();
  const inviteUrl = absoluteUrl(`/invite/${newToken}`);
  await WorkspaceInvite.updateOne(
    { _id: inviteId },
    { $set: { token: newToken, expiresAt: inviteExpiry() } },
  );

  const delivery = await enqueueAndDispatch("invite-email", {
    email: invite.email,
    inviterName: user.name ?? user.email ?? "A team member",
    workspaceName: ws.name,
    inviteUrl,
  });

  revalidatePath(`/w/${slug}/members`);
  if (!delivery.delivered) {
    return {
      ok: true,
      data: { inviteUrl: `/invite/${newToken}` },
      warning: "Invite updated, but the email could not be sent. Share this link manually.",
    };
  }

  return { ok: true, data: { inviteUrl: `/invite/${newToken}` } };
}
