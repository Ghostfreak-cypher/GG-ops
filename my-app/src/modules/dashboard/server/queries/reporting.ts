import { cache } from "react";
import { connectDB } from "@/lib/db";
import { Task } from "@/models/Task";
import { User } from "@/models/User";
import { Project } from "@/models/Project";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";

export type StatusStat = { status: string; count: number };
export type PriorityStat = { priority: string; count: number };
export type MemberStat = { name: string; count: number };
export type ProjectStat2 = { name: string; count: number };

export type ReportingData = {
  byStatus: StatusStat[];
  byPriority: PriorityStat[];
  byMember: MemberStat[];
  byProject: ProjectStat2[];
  totalOpen: number;
};

export const getReportingData = cache(
  async (workspaceId: string): Promise<ReportingData> => {
    await connectDB();
    const wsId = parseObjectIdOrThrow(workspaceId);

    const [byStatusRaw, byPriorityRaw, byMemberRaw, byProjectRaw] = await Promise.all([
      Task.aggregate<{ _id: string; count: number }>([
        { $match: { workspaceId: wsId, isArchived: false } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Task.aggregate<{ _id: string; count: number }>([
        { $match: { workspaceId: wsId, isArchived: false, status: { $ne: "DONE" } } },
        { $group: { _id: "$priority", count: { $sum: 1 } } },
      ]),
      Task.aggregate<{ _id: unknown; count: number }>([
        { $match: { workspaceId: wsId, isArchived: false, status: { $ne: "DONE" } } },
        { $unwind: "$assigneeIds" },
        { $group: { _id: "$assigneeIds", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
      Task.aggregate<{ _id: unknown; count: number }>([
        { $match: { workspaceId: wsId, isArchived: false, status: { $ne: "DONE" } } },
        { $group: { _id: "$projectId", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
    ]);

    const memberIds = byMemberRaw.map((r) => r._id);
    const projectIds = byProjectRaw.map((r) => r._id);

    const [users, projects] = await Promise.all([
      memberIds.length
        ? User.find({ _id: { $in: memberIds } }).select("name").lean()
        : Promise.resolve([]),
      projectIds.length
        ? Project.find({ _id: { $in: projectIds } }).select("name").lean()
        : Promise.resolve([]),
    ]);

    const userNameById = new Map(users.map((u) => [String(u._id), u.name ?? "Unknown"]));
    const projectNameById = new Map(projects.map((p) => [String(p._id), p.name]));

    const STATUS_ORDER = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];
    const byStatus = STATUS_ORDER.map((s) => ({
      status: s,
      count: byStatusRaw.find((r) => r._id === s)?.count ?? 0,
    }));

    const PRIORITY_ORDER = ["URGENT", "HIGH", "MEDIUM", "LOW"];
    const byPriority = PRIORITY_ORDER.map((p) => ({
      priority: p,
      count: byPriorityRaw.find((r) => r._id === p)?.count ?? 0,
    })).filter((p) => p.count > 0);

    const byMember = byMemberRaw
      .map((r) => ({ name: userNameById.get(String(r._id)) ?? "Unknown", count: r.count }))
      .filter((r) => r.count > 0);

    const byProject = byProjectRaw
      .map((r) => ({ name: projectNameById.get(String(r._id)) ?? "Unknown", count: r.count }))
      .filter((r) => r.count > 0);

    const totalOpen = byPriority.reduce((s, r) => s + r.count, 0);

    return { byStatus, byPriority, byMember, byProject, totalOpen };
  },
);
