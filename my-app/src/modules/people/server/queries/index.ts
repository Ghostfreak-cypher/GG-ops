import { Types, type PipelineStage } from "mongoose";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Task } from "@/models/Task";
import { Project } from "@/models/Project";
import { Team } from "@/models/Team";
import { WorkspaceMember } from "@/models/WorkspaceMember";
import type {
  MemberProfileDTO,
  CollaboratorDTO,
  TaskSummaryDTO,
  ProjectSummaryDTO,
  TeamDTO,
} from "@/modules/people/server/dto";
import type { WorkspaceRole } from "@/modules/workspace/roles";

export async function getMemberProfile(
  workspaceId: string,
  userId: string,
): Promise<MemberProfileDTO | null> {
  await connectDB();

  // Independent: `user` is looked up by the `userId` argument, not by anything `membership`
  // returns, so the two reads don't need to be sequential.
  const [membership, user] = await Promise.all([
    WorkspaceMember.findOne({
      workspaceId: new Types.ObjectId(workspaceId),
      userId: new Types.ObjectId(userId),
      status: { $ne: "REMOVED" },
    }).lean(),
    User.findById(userId)
      .select("name email image jobTitle department bio pronounceUrl outOfOfficeEnabled outOfOfficeFrom outOfOfficeUntil outOfOfficeMessage")
      .lean(),
  ]);
  if (!membership) return null;
  if (!user) return null;

  return {
    id: String(membership._id),
    userId: String(user._id),
    name: user.name,
    email: user.email,
    image: user.image ?? null,
    jobTitle: user.jobTitle ?? null,
    department: (user as unknown as Record<string, unknown>).department as string | null ?? null,
    bio: (user as unknown as Record<string, unknown>).bio as string | null ?? null,
    pronounceUrl: (user as unknown as Record<string, unknown>).pronounceUrl as string | null ?? null,
    outOfOfficeEnabled: Boolean((user as unknown as Record<string, unknown>).outOfOfficeEnabled),
    outOfOfficeFrom: (user as unknown as Record<string, unknown>).outOfOfficeFrom ? String((user as unknown as Record<string, unknown>).outOfOfficeFrom) : null,
    outOfOfficeUntil: (user as unknown as Record<string, unknown>).outOfOfficeUntil ? String((user as unknown as Record<string, unknown>).outOfOfficeUntil) : null,
    outOfOfficeMessage: (user as unknown as Record<string, unknown>).outOfOfficeMessage as string | null ?? null,
    role: membership.role as WorkspaceRole,
    joinedAt: membership.joinedAt ? String(membership.joinedAt) : null,
  };
}

export async function searchMembers(
  workspaceId: string,
  query?: string,
  role?: string,
): Promise<MemberProfileDTO[]> {
  await connectDB();

  const membershipFilter: Record<string, unknown> = {
    workspaceId: new Types.ObjectId(workspaceId),
    status: "ACTIVE",
  };
  if (role) membershipFilter.role = role;

  const memberships = await WorkspaceMember.find(membershipFilter).lean();
  if (memberships.length === 0) return [];

  const userIds = memberships.map((m) => m.userId);
  const userFilter: Record<string, unknown> = { _id: { $in: userIds } };
  if (query) {
    const re = new RegExp(query, "i");
    userFilter.$or = [{ name: re }, { email: re }];
  }

  const users = await User.find(userFilter)
    .select("name email image jobTitle department bio pronounceUrl outOfOfficeEnabled outOfOfficeFrom outOfOfficeUntil outOfOfficeMessage")
    .lean();

  const membershipByUserId = new Map(
    memberships.map((m) => [String(m.userId), m]),
  );

  return users.map((u) => {
    const m = membershipByUserId.get(String(u._id))!;
    const ux = u as unknown as Record<string, unknown>;
    return {
      id: String(m._id),
      userId: String(u._id),
      name: u.name,
      email: u.email,
      image: u.image ?? null,
      jobTitle: u.jobTitle ?? null,
      department: ux.department as string | null ?? null,
      bio: ux.bio as string | null ?? null,
      pronounceUrl: ux.pronounceUrl as string | null ?? null,
      outOfOfficeEnabled: Boolean(ux.outOfOfficeEnabled),
      outOfOfficeFrom: ux.outOfOfficeFrom ? String(ux.outOfOfficeFrom) : null,
      outOfOfficeUntil: ux.outOfOfficeUntil ? String(ux.outOfOfficeUntil) : null,
      outOfOfficeMessage: ux.outOfOfficeMessage as string | null ?? null,
      role: m.role as WorkspaceRole,
      joinedAt: m.joinedAt ? String(m.joinedAt) : null,
    };
  });
}

export async function getFrequentCollaborators(
  workspaceId: string,
  userId: string,
  limit = 5,
): Promise<CollaboratorDTO[]> {
  await connectDB();

  const wsId = new Types.ObjectId(workspaceId);
  const uId = new Types.ObjectId(userId);

  const pipeline: PipelineStage[] = [
    { $match: { workspaceId: wsId, assigneeIds: uId, isArchived: false } },
    { $unwind: "$assigneeIds" },
    { $match: { assigneeIds: { $ne: uId } } },
    { $group: { _id: "$assigneeIds", count: { $sum: 1 } } },
    { $sort: { count: -1 as -1 } },
    { $limit: limit },
  ];

  const results = await Task.aggregate(pipeline);
  if (results.length === 0) return [];

  const collabIds = results.map((r: { _id: Types.ObjectId }) => r._id);
  const users = await User.find({ _id: { $in: collabIds } })
    .select("name image jobTitle department")
    .lean();

  const countMap = new Map(
    results.map((r: { _id: Types.ObjectId; count: number }) => [String(r._id), r.count]),
  );

  return users.map((u) => ({
    userId: String(u._id),
    name: u.name,
    image: u.image ?? null,
    jobTitle: u.jobTitle ?? null,
    department: (u as unknown as Record<string, unknown>).department as string | null ?? null,
    sharedTaskCount: countMap.get(String(u._id)) ?? 0,
  }));
}

export async function getMemberOpenTasks(
  workspaceId: string,
  userId: string,
  limit = 8,
): Promise<TaskSummaryDTO[]> {
  await connectDB();

  const tasks = await Task.find({
    workspaceId: new Types.ObjectId(workspaceId),
    assigneeIds: new Types.ObjectId(userId),
    status: { $nin: ["DONE" as const] },
    isArchived: false,
  })
    .select("title status dueDate projectId")
    .sort({ dueDate: 1, createdAt: -1 })
    .limit(limit)
    .lean();

  if (tasks.length === 0) return [];

  const projectIds = [...new Set(tasks.map((t) => String(t.projectId)))];
  const projects = await Project.find({ _id: { $in: projectIds } })
    .select("name color")
    .lean();
  const projectMap = new Map(projects.map((p) => [String(p._id), p]));

  return tasks.map((t) => {
    const p = projectMap.get(String(t.projectId));
    return {
      id: String(t._id),
      title: t.title,
      status: t.status,
      dueDate: t.dueDate ? String(t.dueDate) : null,
      projectId: String(t.projectId),
      projectName: p?.name ?? "Unknown",
      projectColor: p?.color ?? null,
    };
  });
}

export async function getMemberRecentProjects(
  workspaceId: string,
  userId: string,
  limit = 6,
): Promise<ProjectSummaryDTO[]> {
  await connectDB();

  // Find recently-touched tasks assigned to this user and collect unique project IDs in order
  const recentTasks = await Task.find({
    workspaceId: new Types.ObjectId(workspaceId),
    assigneeIds: new Types.ObjectId(userId),
    isArchived: false,
  })
    .select("projectId")
    .sort({ updatedAt: -1 })
    .limit(50)
    .lean();

  const seen = new Set<string>();
  const projectIds: Types.ObjectId[] = [];
  for (const t of recentTasks) {
    const pid = String(t.projectId);
    if (!seen.has(pid)) {
      seen.add(pid);
      projectIds.push(t.projectId as Types.ObjectId);
      if (projectIds.length >= limit) break;
    }
  }

  if (projectIds.length === 0) return [];

  const projects = await Project.find({ _id: { $in: projectIds } })
    .select("name color")
    .lean();

  // For member count we query WorkspaceMember — cheap since it's per project's workspace
  return projects.map((p) => ({
    id: String(p._id),
    name: p.name,
    color: p.color ?? null,
    memberCount: 0, // lightweight: skip second query
  }));
}

export async function listTeams(workspaceId: string, userId?: string): Promise<TeamDTO[]> {
  await connectDB();

  const filter: Record<string, unknown> = {
    workspaceId: new Types.ObjectId(workspaceId),
  };
  // If private teams exist and userId given, show only those where user is a member
  // For now show all (private filter can be added later)

  const teams = await Team.find(filter).sort({ name: 1 }).lean();
  if (teams.length === 0) return [];

  const allMemberIds = [...new Set(teams.flatMap((t) => t.memberIds.map(String)))];
  const users = await User.find({ _id: { $in: allMemberIds } })
    .select("name image jobTitle")
    .lean();
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  return teams.map((t) => {
    const leadSet = new Set(t.leadIds.map(String));
    const members = t.memberIds.map((mid) => {
      const u = userMap.get(String(mid));
      return {
        userId: String(mid),
        name: u?.name ?? "Unknown",
        image: u?.image ?? null,
        jobTitle: u?.jobTitle ?? null,
        isLead: leadSet.has(String(mid)),
      };
    });
    return {
      id: String(t._id),
      workspaceId: String(t.workspaceId),
      name: t.name,
      description: t.description ?? null,
      color: t.color ?? "#000000",
      isPrivate: t.isPrivate ?? false,
      memberIds: t.memberIds.map(String),
      leadIds: t.leadIds.map(String),
      members,
      memberCount: t.memberIds.length,
      createdAt: String(t.createdAt),
    };
  });
}

export async function getTeam(teamId: string, workspaceId: string): Promise<TeamDTO | null> {
  await connectDB();

  const team = await Team.findOne({
    _id: new Types.ObjectId(teamId),
    workspaceId: new Types.ObjectId(workspaceId),
  }).lean();
  if (!team) return null;

  const users = await User.find({ _id: { $in: team.memberIds } })
    .select("name image jobTitle")
    .lean();
  const userMap = new Map(users.map((u) => [String(u._id), u]));
  const leadSet = new Set(team.leadIds.map(String));

  const members = team.memberIds.map((mid) => {
    const u = userMap.get(String(mid));
    return {
      userId: String(mid),
      name: u?.name ?? "Unknown",
      image: u?.image ?? null,
      jobTitle: u?.jobTitle ?? null,
      isLead: leadSet.has(String(mid)),
    };
  });

  return {
    id: String(team._id),
    workspaceId: String(team.workspaceId),
    name: team.name,
    description: team.description ?? null,
    color: team.color ?? "#000000",
    isPrivate: team.isPrivate ?? false,
    memberIds: team.memberIds.map(String),
    leadIds: team.leadIds.map(String),
    members,
    memberCount: team.memberIds.length,
    createdAt: String(team.createdAt),
  };
}
