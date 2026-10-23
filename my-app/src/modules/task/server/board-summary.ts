import { TASK_STATUSES, type TaskStatus } from "@/modules/task/constants";
import type { BoardData } from "@/modules/task/server/dto";

export type BoardSummary = Pick<
  BoardData,
  | "projectId"
  | "projectName"
  | "projectStatusColor"
  | "projectStatusNote"
  | "projectStatusUpdatedAt"
  | "memberCount"
> & {
  taskCount: number;
  /** Every status is present, so a status with no tasks reads 0 rather than missing. */
  countsByStatus: Record<TaskStatus, number>;
  /** Tasks with at least one unresolved blocking dependency. */
  blockedCount: number;
};

/**
 * Status and counts without task content — for integrations (GG-Docs) that only need
 * the numbers. ponytail: counts in memory off the full board query; a `$group`
 * aggregation is the upgrade if this endpoint gets hot.
 */
export function summarizeBoard(board: BoardData): BoardSummary {
  const tasks = [...board.sections.flatMap((s) => s.tasks), ...board.unsectioned];
  const countsByStatus = Object.fromEntries(TASK_STATUSES.map((s) => [s, 0])) as Record<TaskStatus, number>;
  for (const task of tasks) countsByStatus[task.status] += 1;

  return {
    projectId: board.projectId,
    projectName: board.projectName,
    projectStatusColor: board.projectStatusColor,
    projectStatusNote: board.projectStatusNote,
    projectStatusUpdatedAt: board.projectStatusUpdatedAt,
    memberCount: board.memberCount,
    taskCount: tasks.length,
    countsByStatus,
    blockedCount: tasks.filter((t) => t.blockedByCount > 0).length,
  };
}
