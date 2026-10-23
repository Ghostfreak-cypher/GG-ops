"use server";

import { requireUser } from "@/modules/auth/server/session";
import { getTaskDetail } from "@/modules/task/server/queries";
import type { TaskDetailDTO } from "@/modules/task/server/dto";
import type { ActionResult } from "@/lib/action-result";

export async function fetchTaskDetailAction(
  taskId: string,
): Promise<ActionResult<TaskDetailDTO>> {
  const user = await requireUser();
  const task = await getTaskDetail(taskId, user.id);
  if (!task) return { ok: false, error: "Task not found or access denied." };
  return { ok: true, data: task };
}
