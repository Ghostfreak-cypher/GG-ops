import { connectDB } from "@/lib/db";
import { Workspace } from "@/models/Workspace";
import { WorkspaceMember } from "@/models/WorkspaceMember";
import { WorkspaceInvite } from "@/models/WorkspaceInvite";
import { withTransaction } from "@/lib/mongo/transactions";
import { canChangeRole } from "@/modules/workspace/server/permissions";
import { isInviteExpired } from "@/modules/workspace/invites";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { normalizeEmail } from "@/lib/auth-security";
import { absoluteUrl } from "@/lib/urls";
import {
  enqueueWorkspaceJoinedEmail,
  enqueueMemberJoinedEmails,
} from "@/lib/jobs/workspace-email";

type JoinResult =
  | { ok: true; slug: string; name: string }
  | { ok: false; error: string };

/**
 * Consume a pending invite and make the user an ACTIVE workspace member.
 * Shared by the explicit accept flow and the auto-join-on-sign-up flow.
 * Enforces that the invite was addressed to this user's email. Does NOT
 * redirect — callers decide where to send the user afterwards.
 */
export async function joinWorkspaceViaInvite(params: {
  token: string;
  userId: string;
  userEmail: string;
  userName?: string | null;
}): Promise<JoinResult> {
  const { token, userId, userEmail, userName } = params;

  await connectDB();

  const invite = await WorkspaceInvite.findOne({ token });
  if (!invite || invite.acceptedAt) {
    return { ok: false, error: "This invite is invalid or has already been used." };
  }
  if (isInviteExpired(invite.expiresAt)) {
    return { ok: false, error: "This invite has expired." };
  }
  if (normalizeEmail(userEmail) !== invite.email) {
    return { ok: false, error: "This invite was sent to a different email address." };
  }

  const workspace = await Workspace.findById(invite.workspaceId).lean();
  if (!workspace) return { ok: false, error: "That workspace no longer exists." };

  const uid = parseObjectIdOrThrow(userId);

  await withTransaction(async (session) => {
    // A MAINTAINER can never be demoted by accepting an invite to a workspace they
    // already own — keep their role; otherwise apply the invite's role.
    const existing = await WorkspaceMember.findOne(
      { workspaceId: invite.workspaceId, userId: uid },
      null,
      { session },
    );
    const role =
      existing && !canChangeRole(existing.role) ? existing.role : invite.role;

    await WorkspaceMember.updateOne(
      { workspaceId: invite.workspaceId, userId: uid },
      {
        $setOnInsert: {
          workspaceId: invite.workspaceId,
          userId: uid,
          invitedBy: invite.invitedBy,
        },
        $set: { role, status: "ACTIVE", joinedAt: new Date() },
      },
      { upsert: true, session },
    );
    await WorkspaceInvite.updateOne(
      { _id: invite._id },
      { $set: { acceptedAt: new Date() } },
      { session },
    );
  });

  const workspaceUrl = absoluteUrl(`/w/${workspace.slug}`);
  await enqueueWorkspaceJoinedEmail(userId, String(invite.workspaceId), workspace.name, workspaceUrl);
  await enqueueMemberJoinedEmails(
    String(invite.workspaceId),
    userName ?? "Someone",
    invite.role,
    workspace.name,
    workspaceUrl,
    userId,
  );

  return { ok: true, slug: workspace.slug, name: workspace.name };
}
