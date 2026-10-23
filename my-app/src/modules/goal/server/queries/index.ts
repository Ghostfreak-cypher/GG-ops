import { cache } from "react";
import { connectDB } from "@/lib/db";
import { Goal } from "@/models/Goal";
import { Project } from "@/models/Project";
import { Task } from "@/models/Task";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import type { GoalDTO } from "@/modules/goal/server/dto";
import type { GoalStatus } from "@/modules/goal/constants";

type GoalLean = {
  _id: unknown;
  title: string;
  description: string | null;
  status: GoalStatus;
  progress: number;
  parentGoalId: unknown | null;
  period: string | null;
  teamLabel: string | null;
  dueDate: Date | null;
  linkedProjectIds?: unknown[];
  linkedTaskIds?: unknown[];
};

export const listGoals = cache(
  async (workspaceId: string, period?: string): Promise<GoalDTO[]> => {
    await connectDB();
    const workspaceObjectId = parseObjectIdOrThrow(workspaceId);
    const filter: Record<string, unknown> = {
      workspaceId: workspaceObjectId,
      isArchived: false,
    };
    if (period) filter.period = period;

    const raw = (await Goal.find(filter).sort({ createdAt: 1 }).lean()) as unknown as GoalLean[];

    const projectIds = [...new Set(raw.flatMap((goal) => (goal.linkedProjectIds ?? []).map(String)))];
    const taskIds = [...new Set(raw.flatMap((goal) => (goal.linkedTaskIds ?? []).map(String)))];

    const [projects, tasks] = await Promise.all([
      projectIds.length
        ? Project.find({
            _id: { $in: projectIds.map((id) => parseObjectIdOrThrow(id)) },
            workspaceId: workspaceObjectId,
            archivedAt: null,
          })
            .select("name")
            .lean()
        : [],
      taskIds.length
        ? Task.find({
            _id: { $in: taskIds.map((id) => parseObjectIdOrThrow(id)) },
            workspaceId: workspaceObjectId,
            isArchived: false,
          })
            .select("title projectId")
            .lean()
        : [],
    ]);

    const projectById = new Map(projects.map((project) => [String(project._id), project]));
    const taskById = new Map(tasks.map((task) => [String(task._id), task]));

    // Assemble tree in memory (two-pass)
    const byId = new Map<string, GoalDTO>();
    const roots: GoalDTO[] = [];

    for (const g of raw) {
      byId.set(String(g._id), {
        id: String(g._id),
        title: g.title,
        description: g.description,
        status: g.status,
        progress: g.progress,
        parentGoalId: g.parentGoalId ? String(g.parentGoalId) : null,
        period: g.period,
        teamLabel: g.teamLabel,
        dueDate: g.dueDate ? new Date(g.dueDate).toISOString() : null,
        linkedProjects: (g.linkedProjectIds ?? [])
          .map((projectId) => {
            const project = projectById.get(String(projectId));
            return project
              ? {
                  id: String(project._id),
                  name: project.name,
                }
              : null;
          })
          .filter((project): project is NonNullable<typeof project> => project !== null),
        linkedTasks: (g.linkedTaskIds ?? [])
          .map((taskId) => {
            const task = taskById.get(String(taskId));
            if (!task) return null;
            const project = projectById.get(String(task.projectId));
            return {
              id: String(task._id),
              title: task.title,
              projectId: String(task.projectId),
              projectName: project?.name ?? "Unknown project",
            };
          })
          .filter((task): task is NonNullable<typeof task> => task !== null),
        children: [],
      });
    }

    for (const dto of byId.values()) {
      if (dto.parentGoalId && byId.has(dto.parentGoalId)) {
        byId.get(dto.parentGoalId)!.children.push(dto);
      } else {
        roots.push(dto);
      }
    }

    return roots;
  },
);

export const listPeriods = cache(async (workspaceId: string): Promise<string[]> => {
  await connectDB();
  const raw = await Goal.distinct("period", {
    workspaceId: parseObjectIdOrThrow(workspaceId),
    isArchived: false,
    period: { $ne: null },
  });
  return (raw as (string | null)[]).filter((p): p is string => !!p).sort().reverse();
});
