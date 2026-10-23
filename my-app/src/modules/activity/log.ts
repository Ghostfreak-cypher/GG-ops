import { connectDB } from "@/lib/db";
import { ActivityLog } from "@/models/ActivityLog";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { logger } from "@/lib/logger";

type ActivityInput = {
  workspaceId: string;
  projectId?: string;
  taskId?: string;
  actorId: string;
  action: string;
  metadata?: Record<string, unknown>;
};

/**
 * Append an activity-log entry. Best-effort: never throws into the originating
 * mutation (a failed log shouldn't fail the task/comment write).
 */
export async function logActivity(entry: ActivityInput): Promise<void> {
  try {
    await connectDB();
    const entityType = entry.taskId ? "TASK" : entry.projectId ? "PROJECT" : "WORKSPACE";
    const entityId = parseObjectIdOrThrow(entry.taskId ?? entry.projectId ?? entry.workspaceId);
    await ActivityLog.create({
      workspaceId: parseObjectIdOrThrow(entry.workspaceId),
      projectId: entry.projectId ? parseObjectIdOrThrow(entry.projectId) : null,
      taskId: entry.taskId ? parseObjectIdOrThrow(entry.taskId) : null,
      actorId: parseObjectIdOrThrow(entry.actorId),
      entityType,
      entityId,
      action: entry.action,
      metadata: entry.metadata ?? {},
    });
  } catch (error) {
    logger.error("logActivity failed", {
      action: entry.action,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
