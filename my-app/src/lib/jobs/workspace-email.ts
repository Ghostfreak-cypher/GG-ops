import { enqueue } from "@/lib/queue";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { canSendWorkspaceEmail } from "@/lib/notification-preferences";
import { WorkspaceMember } from "@/models/WorkspaceMember";
import { User } from "@/models/User";

export async function enqueueWorkspaceJoinedEmail(
  userId: string,
  workspaceId: string,
  workspaceName: string,
  workspaceUrl: string,
): Promise<void> {
  const user = await User.findById(parseObjectIdOrThrow(userId)).select("email name").lean();
  if (!user?.email) return;
  if (!(await canSendWorkspaceEmail(userId, workspaceId, "WORKSPACE_JOINED"))) return;
  enqueue("workspace-joined-email", {
    email: user.email,
    userName: user.name,
    workspaceName,
    workspaceUrl,
  });
}

export async function enqueueRoleUpdatedEmail(
  targetUserId: string,
  workspaceId: string,
  workspaceName: string,
  workspaceUrl: string,
  newRole: string,
): Promise<void> {
  const user = await User.findById(parseObjectIdOrThrow(targetUserId)).select("email name").lean();
  if (!user?.email) return;
  if (!(await canSendWorkspaceEmail(targetUserId, workspaceId, "ROLE_UPDATED"))) return;
  enqueue("role-updated-email", {
    email: user.email,
    userName: user.name,
    workspaceName,
    newRole,
    workspaceUrl,
  });
}

export async function enqueueMemberJoinedEmails(
  workspaceId: string,
  memberName: string,
  memberRole: string,
  workspaceName: string,
  workspaceUrl: string,
  excludeUserId: string,
): Promise<void> {
  const adminMembers = await WorkspaceMember.find({
    workspaceId: parseObjectIdOrThrow(workspaceId),
    role: { $in: ["MAINTAINER", "ADMIN"] },
    status: "ACTIVE",
    userId: { $ne: parseObjectIdOrThrow(excludeUserId) },
  })
    .select("userId")
    .lean();

  if (adminMembers.length === 0) return;

  const users = await User.find({
    _id: { $in: adminMembers.map((m) => m.userId) },
    isActive: true,
  })
    .select("_id email")
    .lean();

  for (const u of users) {
    if (!u.email) continue;
    if (!(await canSendWorkspaceEmail(String(u._id), workspaceId, "MEMBER_JOINED"))) continue;
    enqueue("member-joined-email", {
      email: u.email,
      memberName,
      workspaceName,
      workspaceUrl,
      role: memberRole,
    });
  }
}
