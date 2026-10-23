"use server";

import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Task } from "@/models/Task";
import { TASK_STATUSES, TASK_PRIORITIES } from "@/modules/task/constants";
import { getProjectForUser } from "@/modules/project/server/access";
import { canEditTasks } from "@/modules/workspace/server/permissions";
import { parseObjectIdOrThrow, isValidObjectId } from "@/lib/mongo/ids";
import { requireUser } from "@/modules/auth/server/session";
import { invalidTaskRef } from "@/modules/task/server/task-refs";
import type { ActionResult } from "@/lib/action-result";

const bulkPatchSchema = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  assigneeIds: z.array(z.string()).optional(),
});

/** Whether the user can edit tasks in every project these tasks belong to. */
async function canEditAll(tasks: { projectId: unknown }[], userId: string): Promise<boolean> {
  const projectIds = [...new Set(tasks.map((t) => String(t.projectId)))];
  const accesses = await Promise.all(projectIds.map((pid) => getProjectForUser(pid, userId)));
  return accesses.every((access) => !!access && canEditTasks(access.role));
}

export async function bulkUpdateTasksAction(
  taskIds: string[],
  patch: unknown,
): Promise<ActionResult> {
  if (!taskIds.length) return { ok: true };

  const parsed = bulkPatchSchema.safeParse(patch);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;
  if (!Object.keys(d).length) return { ok: true };

  const user = await requireUser();
  await connectDB();

  const validIds = taskIds.filter(isValidObjectId).map(parseObjectIdOrThrow);
  if (!validIds.length) return { ok: false, error: "No valid task IDs." };

  const tasks = await Task.find({ _id: { $in: validIds }, isArchived: false })
    .select("projectId workspaceId")
    .lean();
  if (!tasks.length) return { ok: false, error: "Tasks not found." };

  if (!(await canEditAll(tasks, user.id))) {
    return { ok: false, error: "You don't have permission to edit some tasks." };
  }

  const updateDoc: Record<string, unknown> = {};
  if (d.status !== undefined) {
    updateDoc.status = d.status;
    if (d.status === "DONE") updateDoc.completedAt = new Date();
    else updateDoc.completedAt = null;
  }
  if (d.priority !== undefined) updateDoc.priority = d.priority;
  if (d.assigneeIds !== undefined) {
    const assigneeIds = d.assigneeIds.filter(isValidObjectId).map(parseObjectIdOrThrow);
    const workspaceIds = [...new Set(tasks.map((t) => String(t.workspaceId)))];
    const refErrors = await Promise.all(
      workspaceIds.map((ws) => invalidTaskRef(parseObjectIdOrThrow(ws), { assigneeIds })),
    );
    const refError = refErrors.find((e) => e !== null);
    if (refError) return { ok: false, error: refError };
    updateDoc.assigneeIds = assigneeIds;
  }
  updateDoc.updatedBy = parseObjectIdOrThrow(user.id);

  // Only the tasks permission-checked above — not every id the client sent.
  await Task.updateMany({ _id: { $in: tasks.map((t) => t._id) } }, { $set: updateDoc });
  return { ok: true };
}

export async function bulkArchiveTasksAction(taskIds: string[]): Promise<ActionResult> {
  if (!taskIds.length) return { ok: true };
  const user = await requireUser();
  await connectDB();

  const validIds = taskIds.filter(isValidObjectId).map(parseObjectIdOrThrow);
  const tasks = await Task.find({ _id: { $in: validIds }, isArchived: false })
    .select("projectId")
    .lean();

  if (!(await canEditAll(tasks, user.id))) {
    return { ok: false, error: "You don't have permission to archive some tasks." };
  }

  await Task.updateMany(
    { _id: { $in: tasks.map((t) => t._id) } },
    { $set: { isArchived: true, updatedBy: parseObjectIdOrThrow(user.id) } },
  );
  return { ok: true };
}
