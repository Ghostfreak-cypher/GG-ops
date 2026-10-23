"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { WorkspaceMember } from "@/models/WorkspaceMember";
import { WorkspaceInvite } from "@/models/WorkspaceInvite";
import { inviteSchema } from "@/modules/workspace/schemas";
import { canInviteMembers } from "@/modules/workspace/server/permissions";
import { generateInviteToken, inviteExpiry } from "@/modules/workspace/invites";
import { getWorkspaceForUser } from "@/modules/workspace/server/queries";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { requireUser } from "@/modules/auth/server/session";
import { enqueueAndDispatch } from "@/lib/queue";
import { absoluteUrl } from "@/lib/urls";
import { rateLimit } from "@/lib/rate-limit";
import type { ActionResult } from "@/lib/action-result";

export async function inviteMemberAction(
  slug: string,
  input: unknown,
): Promise<ActionResult<{ inviteUrl: string }>> {
  const user = await requireUser();

  // Re-derive the workspace + the caller's role from the server (never trust the client).
  const ws = await getWorkspaceForUser(slug, user.id);
  if (!ws) return { ok: false, error: "Workspace not found." };
  if (!canInviteMembers(ws.role)) {
    return { ok: false, error: "You don't have permission to invite members." };
  }

  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await connectDB();
  const workspaceId = parseObjectIdOrThrow(ws.id);
  const email = parsed.data.email.toLowerCase();
  const limited = await rateLimit(`invite:${ws.id}:${user.id}`, 20, 3600);
  if (!limited.allowed) return { ok: false, error: "Too many invites. Try again later." };

  const existingUser = await User.findOne({ email }).select("_id").lean();
  if (existingUser) {
    const already = await WorkspaceMember.findOne({
      workspaceId,
      userId: existingUser._id,
      status: "ACTIVE",
    }).lean();
    if (already) return { ok: false, error: "That person is already a member." };
  }

  const token = generateInviteToken();
  const inviteUrl = absoluteUrl(`/invite/${token}`);
  await WorkspaceInvite.create({
    workspaceId,
    email,
    role: parsed.data.role,
    invitedBy: parseObjectIdOrThrow(user.id),
    token,
    expiresAt: inviteExpiry(),
  });

  const delivery = await enqueueAndDispatch("invite-email", {
    email,
    inviterName: user.name ?? user.email ?? "A team member",
    workspaceName: ws.name,
    inviteUrl,
  });

  revalidatePath(`/w/${slug}/members`);
  if (!delivery.delivered) {
    return {
      ok: true,
      data: { inviteUrl: `/invite/${token}` },
      warning: "Invite created, but the email could not be sent. Share this link manually.",
    };
  }

  // The invite link is also returned so it can be shared manually (email is the async path).
  return { ok: true, data: { inviteUrl: `/invite/${token}` } };
}
