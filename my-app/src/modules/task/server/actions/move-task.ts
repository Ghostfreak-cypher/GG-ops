"use server";

import { connectDB } from "@/lib/db";
import { Task } from "@/models/Task";
import { withTransaction } from "@/lib/mongo/transactions";
import { moveTaskSchema } from "@/modules/task/schemas";
import { getProjectForUser, assertSectionInProject } from "@/modules/project/server/access";
import { canEditTasks } from "@/modules/workspace/server/permissions";
import { reindexPositions } from "@/modules/task/position";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { requireUser } from "@/modules/auth/server/session";
import { logActivity } from "@/modules/activity/log";
import { logger } from "@/lib/logger";
import { publish } from "@/lib/pusher";
import type { ActionResult } from "@/lib/action-result";

/**
 * Move/reorder a task: set its (possibly new) section and re-space the destination
 * column's positions in one transaction. The single place drag-drop persistence lives.
 */
export async function moveTaskAction(taskId: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  await connectDB();

  const task = await Task.findById(parseObjectIdOrThrow(taskId)).lean();
  if (!task) return { ok: false, error: "Task not found." };

  const access = await getProjectForUser(String(task.projectId), user.id);
  if (!access) return { ok: false, error: "Not allowed." };
  if (!canEditTasks(access.role)) return { ok: false, error: "You don't have permission." };

  const parsed = moveTaskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { destSectionId, orderedIds } = parsed.data;

  if (!orderedIds.includes(taskId)) {
    return { ok: false, error: "The ordering must include the moved task." };
  }

  const projectId = task.projectId;
  const workspaceId = parseObjectIdOrThrow(access.project.workspaceId);

  if (destSectionId && !(await assertSectionInProject(destSectionId, String(projectId)))) {
    return { ok: false, error: "Destination section is not in this project." };
  }

  const ids = orderedIds.map((id) => parseObjectIdOrThrow(id));
  const count = await Task.countDocuments({ _id: { $in: ids }, projectId, workspaceId });
  if (count !== ids.length) {
    return { ok: false, error: "Some tasks don't belong to this project." };
  }

  const dest = destSectionId ? parseObjectIdOrThrow(destSectionId) : null;
  const positions = reindexPositions(orderedIds);

  const t0 = performance.now();
  await withTransaction(async (s) => {
    await Task.updateOne(
      { _id: parseObjectIdOrThrow(taskId) },
      { $set: { sectionId: dest } },
      { session: s },
    );
    // One round trip instead of one per task in the destination column — same filters,
    // same $set, same session and (ordered: true) the same left-to-right write order as
    // the loop it replaces, just batched into a single command.
    await Task.bulkWrite(
      positions.map(({ id, position }) => ({
        updateOne: {
          filter: { _id: parseObjectIdOrThrow(id), projectId },
          update: { $set: { position } },
        },
      })),
      { session: s, ordered: true },
    );
  });
  logger.perf("task.move", performance.now() - t0, {
    workspaceId: access.project.workspaceId,
    projectId: String(projectId),
    taskId,
    taskCount: orderedIds.length,
  });

  await logActivity({
    workspaceId: access.project.workspaceId,
    projectId: String(projectId),
    taskId,
    actorId: user.id,
    action: "TASK_MOVED",
  });

  await publish(`project-${String(projectId)}`, "task.changed", {
    projectId: String(projectId),
  });

  return { ok: true };
}
