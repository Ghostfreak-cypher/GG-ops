import { connectDB } from "@/lib/db";
import { Task } from "@/models/Task";
import { TaskDependency } from "@/models/TaskDependency";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";

export type DependencyEdge = { fromTaskId: string; toTaskId: string };

/** All dependency edges for tasks in a given project (for Timeline arrows). */
export async function getProjectDependencies(
  workspaceId: string,
  projectId: string,
): Promise<DependencyEdge[]> {
  await connectDB();
  const wsId = parseObjectIdOrThrow(workspaceId);
  const pid = parseObjectIdOrThrow(projectId);

  // Get all task IDs in the project
  const taskIds = await Task.find({ workspaceId: wsId, projectId: pid, isArchived: false })
    .select("_id")
    .lean()
    .then((ts) => ts.map((t) => t._id));

  if (taskIds.length === 0) return [];

  const edges = await TaskDependency.find({
    workspaceId: wsId,
    fromTaskId: { $in: taskIds },
    toTaskId: { $in: taskIds },
  })
    .select("fromTaskId toTaskId")
    .lean();

  return edges.map((e) => ({
    fromTaskId: String(e.fromTaskId),
    toTaskId: String(e.toTaskId),
  }));
}
