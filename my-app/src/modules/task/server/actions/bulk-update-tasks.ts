"use server";

import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Task } from "@/models/Task";
import { TASK_STATUSES, TASK_PRIORITIES } from "@/modules/task/constants";
import { getProjectForUser } from "@/modules/project/server/access";
import { canEditTasks } from "@/modules/workspace/server/permissions";
import { parseObjectIdOrThrow, isValidObjectId } from "@/lib/mongo/ids";
import { requireUser } from "@/modules/auth/server/session";
import type { ActionResult } from "@/lib/action-result";

const bulkPatchSchema = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  assigneeIds: z.array(z.string()).optional(),
});

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
    .select("projectId")
    .lean();
  if (!tasks.length) return { ok: false, error: "Tasks not found." };

  const projectIds = [...new Set(tasks.map((t) => String(t.projectId)))];
  for (const pid of projectIds) {
    const access = await getProjectForUser(pid, user.id);
    if (!access || !canEditTasks(access.role)) {
      return { ok: false, error: "You don't have permission to edit some tasks." };
    }
  }

  const updateDoc: Record<string, unknown> = {};
  if (d.status !== undefined) {
    updateDoc.status = d.status;
    if (d.status === "DONE") updateDoc.completedAt = new Date();
    else updateDoc.completedAt = null;
  }
  if (d.priority !== undefined) updateDoc.priority = d.priority;
  if (d.assigneeIds !== undefined) {
    updateDoc.assigneeIds = d.assigneeIds.filter(isValidObjectId).map(parseObjectIdOrThrow);
  }
  updateDoc.updatedBy = parseObjectIdOrThrow(user.id);

  await Task.updateMany({ _id: { $in: validIds } }, { $set: updateDoc });
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

  const projectIds = [...new Set(tasks.map((t) => String(t.projectId)))];
  for (const pid of projectIds) {
    const access = await getProjectForUser(pid, user.id);
    if (!access || !canEditTasks(access.role)) {
      return { ok: false, error: "You don't have permission to archive some tasks." };
    }
  }

  await Task.updateMany(
    { _id: { $in: validIds } },
    { $set: { isArchived: true, updatedBy: parseObjectIdOrThrow(user.id) } },
  );
  return { ok: true };
}
