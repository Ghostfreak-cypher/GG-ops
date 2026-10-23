import { cache } from "react";
import { connectDB } from "@/lib/db";
import { Task } from "@/models/Task";
import { Project } from "@/models/Project";
import { User } from "@/models/User";
import { WorkspaceMember } from "@/models/WorkspaceMember";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";

export type CapacityMember = { id: string; name: string; image: string | null };
export type CapacityProject = { id: string; name: string; color: string | null };
export type CapacityCell = { memberId: string; projectId: string; monthKey: string; count: number };

export type CapacityData = {
  months: { key: string; label: string }[];
  members: CapacityMember[];
  projects: CapacityProject[];
  cells: CapacityCell[];
};

export const getCapacityData = cache(
  async (workspaceId: string): Promise<CapacityData> => {
    await connectDB();
    const wsId = parseObjectIdOrThrow(workspaceId);

    // 4-month window: previous month + current + next 2
    const now = new Date();
    const months: { key: string; label: string; start: Date; end: Date }[] = [];
    for (let i = -1; i <= 2; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("default", { month: "long" });
      months.push({ key, label, start, end });
    }

    // Tasks with dueDate in window
    const tasks = await Task.find({
      workspaceId: wsId,
      isArchived: false,
      status: { $ne: "DONE" },
      dueDate: { $gte: months[0].start, $lte: months[months.length - 1].end },
      assigneeIds: { $exists: true, $ne: [] },
    })
      .select("assigneeIds projectId dueDate")
      .lean();

    if (tasks.length === 0) {
      return { months: months.map(({ key, label }) => ({ key, label })), members: [], projects: [], cells: [] };
    }

    const memberIds = [...new Set(tasks.flatMap((t) => t.assigneeIds.map(String)))];
    const projectIds = [...new Set(tasks.map((t) => String(t.projectId)))];

    const [memberships, projects, users] = await Promise.all([
      WorkspaceMember.find({ workspaceId: wsId, userId: { $in: memberIds }, status: "ACTIVE" })
        .select("userId")
        .lean(),
      Project.find({ _id: { $in: projectIds } }).select("name color").lean(),
      User.find({ _id: { $in: memberIds } }).select("name image").lean(),
    ]);

    const activeMemberIds = new Set(memberships.map((m) => String(m.userId)));
    const userById = new Map(users.map((u) => [String(u._id), u]));
    const projectById = new Map(projects.map((p) => [String(p._id), p]));

    // Build cell counts
    const cellMap = new Map<string, number>();
    for (const task of tasks) {
      const taskDate = new Date(task.dueDate!);
      const taskKey = `${taskDate.getFullYear()}-${String(taskDate.getMonth() + 1).padStart(2, "0")}`;
      for (const assigneeId of task.assigneeIds) {
        const memberId = String(assigneeId);
        if (!activeMemberIds.has(memberId)) continue;
        const projectId = String(task.projectId);
        const cellKey = `${memberId}::${projectId}::${taskKey}`;
        cellMap.set(cellKey, (cellMap.get(cellKey) ?? 0) + 1);
      }
    }

    const cells: CapacityCell[] = [];
    for (const [key, count] of cellMap.entries()) {
      const [memberId, projectId, monthKey] = key.split("::");
      cells.push({ memberId, projectId, monthKey, count });
    }

    const activeMembers: CapacityMember[] = [...activeMemberIds]
      .map((id) => {
        const u = userById.get(id);
        return u ? { id, name: u.name ?? "Unknown", image: (u.image as string | null) ?? null } : null;
      })
      .filter((m): m is CapacityMember => m !== null);

    const activeProjects: CapacityProject[] = projectIds
      .map((id) => {
        const p = projectById.get(id);
        return p ? { id, name: p.name, color: (p.color as string | null) ?? null } : null;
      })
      .filter((p): p is CapacityProject => p !== null);

    return {
      months: months.map(({ key, label }) => ({ key, label })),
      members: activeMembers,
      projects: activeProjects,
      cells,
    };
  },
);
