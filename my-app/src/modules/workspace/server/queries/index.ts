import { cache } from "react";
import { connectDB } from "@/lib/db";
import { Workspace } from "@/models/Workspace";
import { WorkspaceMember } from "@/models/WorkspaceMember";
import { WorkspaceInvite } from "@/models/WorkspaceInvite";
import { User } from "@/models/User";
import { absoluteUrl } from "@/lib/urls";
import type { WorkspaceRole, MemberStatus } from "@/modules/workspace/roles";
import type { WorkspaceSummary, MemberDTO, PendingInviteDTO } from "@/modules/workspace/server/dto";

/** Workspaces the user is an active member of, with their role in each. */
export const getUserWorkspaces = cache(
  async (userId: string): Promise<WorkspaceSummary[]> => {
    await connectDB();
    const memberships = await WorkspaceMember.find({ userId, status: "ACTIVE" }).lean();
    if (memberships.length === 0) return [];

    const workspaceIds = memberships.map((m) => m.workspaceId);
    const workspaces = await Workspace.find({ _id: { $in: workspaceIds } }).lean();
    const membershipByWorkspace = new Map(memberships.map((m) => [String(m.workspaceId), m]));

    return workspaces.map((w) => {
      const membership = membershipByWorkspace.get(String(w._id));
      return {
        id: String(w._id),
        name: w.name,
        slug: w.slug,
        role: (membership?.role as WorkspaceRole) ?? "MEMBER",
      };
    });
  },
);

/**
 * A workspace by slug, but only if the user is an active member (access control).
 *
 * Fetches the workspace and the user's own active memberships in parallel — the same
 * "fetch both, match in memory" shape `getUserWorkspaces` above uses — rather than looking
 * up the workspace first and then querying its membership by id. A user's membership count
 * is small (they're rarely in more than a handful of workspaces), so filtering in memory
 * costs nothing and removes a serial round trip that ran on every authenticated page.
 */
export const getWorkspaceForUser = cache(
  async (slug: string, userId: string): Promise<WorkspaceSummary | null> => {
    await connectDB();
    const [workspace, memberships] = await Promise.all([
      Workspace.findOne({ slug }).lean(),
      WorkspaceMember.find({ userId, status: "ACTIVE" }).lean(),
    ]);
    if (!workspace) return null;

    const membership = memberships.find((m) => String(m.workspaceId) === String(workspace._id));
    if (!membership) return null;

    return {
      id: String(workspace._id),
      name: workspace.name,
      slug: workspace.slug,
      role: membership.role as WorkspaceRole,
    };
  },
);

/** All non-removed members of a workspace, with user info mapped in memory. */
export async function listMembers(workspaceId: string): Promise<MemberDTO[]> {
  await connectDB();
  const members = await WorkspaceMember.find({
    workspaceId,
    status: { $ne: "REMOVED" },
  }).lean();
  if (members.length === 0) return [];

  const userIds = members.map((m) => m.userId);
  const users = await User.find({ _id: { $in: userIds } })
    .select("name email image jobTitle")
    .lean();
  const userById = new Map(users.map((u) => [String(u._id), u]));

  return members.map((m) => {
    const u = userById.get(String(m.userId));
    return {
      id: String(m._id),
      userId: String(m.userId),
      name: u?.name ?? "Unknown",
      email: u?.email ?? "",
      image: u?.image ?? null,
      jobTitle: (u as unknown as Record<string, unknown>)?.jobTitle as string | null ?? null,
      role: m.role as WorkspaceRole,
      status: m.status as MemberStatus,
      joinedAt: m.joinedAt ? m.joinedAt.toISOString() : null,
    };
  });
}

/** Pending (not yet accepted, not expired) invites for a workspace. */
export async function listPendingInvites(workspaceId: string): Promise<PendingInviteDTO[]> {
  await connectDB();
  const invites = await WorkspaceInvite.find({
    workspaceId,
    acceptedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .lean();
  if (invites.length === 0) return [];

  const inviterIds = [...new Set(invites.map((i) => String(i.invitedBy)).filter(Boolean))];
  const inviters = await User.find({ _id: { $in: inviterIds } })
    .select("name")
    .lean();
  const inviterMap = new Map(inviters.map((u) => [String(u._id), u.name]));

  const now = Date.now();

  return invites.map((i) => ({
    id: String(i._id),
    email: i.email,
    role: i.role as WorkspaceRole,
    expiresAt: i.expiresAt.toISOString(),
    daysLeft: Math.ceil((i.expiresAt.getTime() - now) / (1000 * 60 * 60 * 24)),
    createdAt: i.createdAt!.toISOString(),
    invitedByName: inviterMap.get(String(i.invitedBy)) ?? null,
    inviteUrl: absoluteUrl(`/invite/${i.token}`),
  }));
}
