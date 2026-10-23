import { cache } from "react";
import { connectDB } from "@/lib/db";
import { Task } from "@/models/Task";
import { TaskDependency } from "@/models/TaskDependency";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";

export type DependencyTask = {
  id: string;
  title: string;
  status: string;
  projectId: string;
};

export type TaskDependencies = {
  /** Tasks that THIS task is blocked by (toTaskId = this task) */
  blockedBy: DependencyTask[];
  /** Tasks that THIS task is blocking (fromTaskId = this task) */
  blocking: DependencyTask[];
};

export const getTaskDependencies = cache(
  async (workspaceId: string, taskId: string): Promise<TaskDependencies> => {
    await connectDB();
    const wsId = parseObjectIdOrThrow(workspaceId);
    const tid = parseObjectIdOrThrow(taskId);

    const [asBlocked, asBlocker] = await Promise.all([
      // This task is blocked by toTaskId
      TaskDependency.find({ workspaceId: wsId, fromTaskId: tid }).select("toTaskId").lean(),
      // This task is blocking fromTaskId
      TaskDependency.find({ workspaceId: wsId, toTaskId: tid }).select("fromTaskId").lean(),
    ]);

    const blockedByIds = asBlocked.map((d) => d.toTaskId);
    const blockingIds = asBlocker.map((d) => d.fromTaskId);
    const allIds = [...blockedByIds, ...blockingIds];

    if (allIds.length === 0) return { blockedBy: [], blocking: [] };

    const tasks = await Task.find({ _id: { $in: allIds } })
      .select("title status projectId")
      .lean();

    const byId = new Map(tasks.map((t) => [String(t._id), t]));

    function toDto(id: unknown): DependencyTask | null {
      const t = byId.get(String(id));
      if (!t) return null;
      return {
        id: String(t._id),
        title: t.title,
        status: t.status as string,
        projectId: String(t.projectId),
      };
    }

    return {
      blockedBy: blockedByIds.map(toDto).filter(Boolean) as DependencyTask[],
      blocking: blockingIds.map(toDto).filter(Boolean) as DependencyTask[],
    };
  },
);
