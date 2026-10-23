import { cache } from "react";
import { connectDB } from "@/lib/db";
import { Task } from "@/models/Task";
import { Project } from "@/models/Project";
import { WorkspaceMember } from "@/models/WorkspaceMember";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import type { TaskStatus, TaskPriority } from "@/modules/task/constants";

export type MyTaskDTO = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  completedAt: string | null;
  labelIds: string[];
  projectId: string;
  projectName: string;
};

/** Tasks assigned to the user across a workspace (spec §9.3), with project names. */
export const getMyTasks = cache(
  async (workspaceId: string, userId: string): Promise<MyTaskDTO[]> => {
    await connectDB();
    const tasks = await Task.find({
      workspaceId: parseObjectIdOrThrow(workspaceId),
      assigneeIds: parseObjectIdOrThrow(userId),
      isArchived: false,
    })
      // Only these fields reach MyTaskDTO below — this backs home, my-tasks, calendar and
      // a v1 API route, so the un-selected description/createdBy/position/etc. would
      // otherwise be fetched and discarded on every one of them. The sort fields
      // (dueDate/updatedAt) don't need to be in the projection to be sorted on.
      .select("title status priority dueDate completedAt labelIds projectId")
      .sort({ dueDate: 1, updatedAt: -1 })
      .lean();

    const projectIds = [...new Set(tasks.map((t) => String(t.projectId)))];
    const projects = projectIds.length
      ? await Project.find({ _id: { $in: projectIds } }).select("name").lean()
      : [];
    const nameById = new Map(projects.map((p) => [String(p._id), p.name]));

    return tasks.map((t) => ({
      id: String(t._id),
      title: t.title,
      status: t.status as TaskStatus,
      priority: t.priority as TaskPriority,
      dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
      completedAt: t.completedAt ? new Date(t.completedAt).toISOString() : null,
      labelIds: (t.labelIds ?? []).map((id) => String(id)),
      projectId: String(t.projectId),
      projectName: nameById.get(String(t.projectId)) ?? "—",
    }));
  },
);

export type ProjectStat = { projectId: string; projectName: string; open: number };
export type DashboardData = {
  myOpen: number;
  overdue: number;
  completedThisWeek: number;
  projects: ProjectStat[];
};

/** Workspace dashboard aggregates (spec §9.4). */
export const getWorkspaceDashboard = cache(
  async (workspaceId: string, userId: string): Promise<DashboardData> => {
    await connectDB();
    const wsId = parseObjectIdOrThrow(workspaceId);
    const uId = parseObjectIdOrThrow(userId);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

    const [myOpen, overdue, completedThisWeek, agg] = await Promise.all([
      Task.countDocuments({
        workspaceId: wsId,
        assigneeIds: uId,
        isArchived: false,
        status: { $ne: "DONE" },
      }),
      Task.countDocuments({
        workspaceId: wsId,
        isArchived: false,
        status: { $ne: "DONE" },
        dueDate: { $lt: now },
      }),
      Task.countDocuments({
        workspaceId: wsId,
        status: "DONE",
        completedAt: { $gte: weekAgo },
      }),
      Task.aggregate<{ _id: unknown; open: number }>([
        { $match: { workspaceId: wsId, isArchived: false, status: { $ne: "DONE" } } },
        { $group: { _id: "$projectId", open: { $sum: 1 } } },
      ]),
    ]);

    const projectIds = agg.map((a) => a._id);
    const projects = projectIds.length
      ? await Project.find({ _id: { $in: projectIds }, archivedAt: null }).select("name").lean()
      : [];
    const nameById = new Map(projects.map((p) => [String(p._id), p.name]));

    const projectStats = agg
      .map((a) => ({
        projectId: String(a._id),
        projectName: nameById.get(String(a._id)) ?? "",
        open: a.open,
      }))
      .filter((p) => p.projectName)
      .sort((a, b) => b.open - a.open);

    return { myOpen, overdue, completedThisWeek, projects: projectStats };
  },
);

export const getMemberCount = cache(async (workspaceId: string): Promise<number> => {
  await connectDB();
  return WorkspaceMember.countDocuments({
    workspaceId: parseObjectIdOrThrow(workspaceId),
    status: "ACTIVE",
  });
});

export type CompletedTaskDTO = { id: string; title: string; projectId: string; projectName: string; completedAt: string };

export const getRecentlyCompleted = cache(
  async (workspaceId: string, userId: string): Promise<CompletedTaskDTO[]> => {
    await connectDB();
    const since = new Date(Date.now() - 14 * 24 * 3600 * 1000);
    const tasks = await Task.find({
      workspaceId: parseObjectIdOrThrow(workspaceId),
      assigneeIds: parseObjectIdOrThrow(userId),
      status: "DONE",
      completedAt: { $gte: since },
    })
      .sort({ completedAt: -1 })
      .limit(20)
      .lean();

    const projectIds = [...new Set(tasks.map((t) => String(t.projectId)))];
    const projects = projectIds.length
      ? await Project.find({ _id: { $in: projectIds } }).select("name").lean()
      : [];
    const nameById = new Map(projects.map((p) => [String(p._id), p.name]));

    return tasks.map((t) => ({
      id: String(t._id),
      title: t.title,
      projectId: String(t.projectId),
      projectName: nameById.get(String(t.projectId)) ?? "—",
      completedAt: t.completedAt ? new Date(t.completedAt).toISOString() : new Date().toISOString(),
    }));
  },
);
