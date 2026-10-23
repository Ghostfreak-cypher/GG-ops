"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { Task } from "@/models/Task";
import { TaskDependency } from "@/models/TaskDependency";
import { getProjectForUser } from "@/modules/project/server/access";
import { canEditTasks } from "@/modules/workspace/server/permissions";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { requireUser } from "@/modules/auth/server/session";
import type { ActionResult } from "@/lib/action-result";

const addSchema = z.object({
  fromTaskId: z.string().min(1),
  toTaskId: z.string().min(1),
});

import type { Types } from "mongoose";

/** BFS: check if `startId` can reach `targetId` following fromTaskId → toTaskId edges. */
async function wouldCreateCycle(
  wsId: Types.ObjectId,
  startId: string,
  targetId: string,
): Promise<boolean> {
  const visited = new Set<string>();
  const queue = [startId];
  while (queue.length) {
    const current = queue.shift()!;
    if (current === targetId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const edges = await TaskDependency.find({
      workspaceId: wsId,
      fromTaskId: parseObjectIdOrThrow(current),
    })
      .select("toTaskId")
      .lean();
    for (const e of edges) queue.push(String(e.toTaskId));
  }
  return false;
}

export async function addDependencyAction(
  slug: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  await connectDB();

  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const { fromTaskId, toTaskId } = parsed.data;
  if (fromTaskId === toTaskId) return { ok: false, error: "A task cannot depend on itself." };

  const fromTask = await Task.findById(parseObjectIdOrThrow(fromTaskId)).select("projectId workspaceId").lean();
  if (!fromTask) return { ok: false, error: "Task not found." };

  const access = await getProjectForUser(String(fromTask.projectId), user.id);
  if (!access) return { ok: false, error: "Not allowed." };
  if (!canEditTasks(access.role)) return { ok: false, error: "You don't have permission." };

  const toTask = await Task.findById(parseObjectIdOrThrow(toTaskId))
    .select("workspaceId")
    .lean();
  if (!toTask) return { ok: false, error: "Blocking task not found." };
  if (String(toTask.workspaceId) !== access.project.workspaceId) {
    return { ok: false, error: "Tasks must be in the same workspace." };
  }

  const wsId = parseObjectIdOrThrow(access.project.workspaceId);

  // Circular-dependency guard: would adding fromTask → toTask create a cycle?
  // A cycle exists if toTask already reaches fromTask.
  const cycle = await wouldCreateCycle(wsId, toTaskId, fromTaskId);
  if (cycle) return { ok: false, error: "This dependency would create a cycle." };

  const dep = await TaskDependency.findOneAndUpdate(
    {
      workspaceId: wsId,
      fromTaskId: parseObjectIdOrThrow(fromTaskId),
      toTaskId: parseObjectIdOrThrow(toTaskId),
    },
    {
      $setOnInsert: {
        workspaceId: wsId,
        fromTaskId: parseObjectIdOrThrow(fromTaskId),
        toTaskId: parseObjectIdOrThrow(toTaskId),
        type: "BLOCKS",
        createdBy: parseObjectIdOrThrow(user.id),
      },
    },
    { upsert: true, new: true },
  );

  revalidatePath(`/w/${slug}/projects`);
  return { ok: true, data: { id: String(dep._id) } };
}

export async function removeDependencyAction(
  slug: string,
  input: unknown,
): Promise<ActionResult> {
  const user = await requireUser();
  await connectDB();

  const parsed = z.object({ dependencyId: z.string().min(1) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const dep = await TaskDependency.findById(parseObjectIdOrThrow(parsed.data.dependencyId)).lean();
  if (!dep) return { ok: false, error: "Dependency not found." };

  const fromTask = await Task.findById(dep.fromTaskId).select("projectId").lean();
  if (!fromTask) return { ok: false, error: "Task not found." };

  const access = await getProjectForUser(String(fromTask.projectId), user.id);
  if (!access) return { ok: false, error: "Not allowed." };
  if (!canEditTasks(access.role)) return { ok: false, error: "You don't have permission." };

  await TaskDependency.deleteOne({ _id: dep._id });

  revalidatePath(`/w/${slug}/projects`);
  return { ok: true };
}
