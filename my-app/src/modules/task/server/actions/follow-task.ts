"use server";

import { connectDB } from "@/lib/db";
import { Task } from "@/models/Task";
import { TaskFollow } from "@/models/TaskFollow";
import { getWorkspaceForUser } from "@/modules/workspace/server/queries";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { requireUser } from "@/modules/auth/server/session";
import type { ActionResult } from "@/lib/action-result";

export async function followTaskAction(
  workspaceSlug: string,
  taskId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const ws = await getWorkspaceForUser(workspaceSlug, user.id);
  if (!ws) return { ok: false, error: "Workspace not found." };

  await connectDB();

  const taskExists = await Task.exists({
    _id: parseObjectIdOrThrow(taskId),
    workspaceId: parseObjectIdOrThrow(ws.id),
  });
  if (!taskExists) return { ok: false, error: "Task not found." };

  await TaskFollow.findOneAndUpdate(
    {
      workspaceId: parseObjectIdOrThrow(ws.id),
      taskId: parseObjectIdOrThrow(taskId),
      userId: parseObjectIdOrThrow(user.id),
    },
    {},
    { upsert: true },
  );

  return { ok: true };
}

export async function unfollowTaskAction(
  workspaceSlug: string,
  taskId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const ws = await getWorkspaceForUser(workspaceSlug, user.id);
  if (!ws) return { ok: false, error: "Workspace not found." };

  await connectDB();

  const taskExists = await Task.exists({
    _id: parseObjectIdOrThrow(taskId),
    workspaceId: parseObjectIdOrThrow(ws.id),
  });
  if (!taskExists) return { ok: false, error: "Task not found." };

  await TaskFollow.deleteOne({
    workspaceId: parseObjectIdOrThrow(ws.id),
    taskId: parseObjectIdOrThrow(taskId),
    userId: parseObjectIdOrThrow(user.id),
  });

  return { ok: true };
}
