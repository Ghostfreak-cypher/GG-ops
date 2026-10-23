"use server";

import { connectDB } from "@/lib/db";
import { Task } from "@/models/Task";
import { getProjectForUser } from "@/modules/project/server/access";
import { canEditTasks } from "@/modules/workspace/server/permissions";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { requireUser } from "@/modules/auth/server/session";
import { publish } from "@/lib/pusher";
import type { ActionResult } from "@/lib/action-result";

export async function archiveTaskAction(taskId: string): Promise<ActionResult> {
  const user = await requireUser();
  await connectDB();

  const task = await Task.findById(parseObjectIdOrThrow(taskId));
  if (!task) return { ok: false, error: "Task not found." };

  const access = await getProjectForUser(String(task.projectId), user.id);
  if (!access) return { ok: false, error: "Not allowed." };
  if (!canEditTasks(access.role)) return { ok: false, error: "You don't have permission." };

  task.isArchived = true;
  await task.save();
  await publish(`project-${String(task.projectId)}`, "task.changed", {
    projectId: String(task.projectId),
  });
  return { ok: true };
}
