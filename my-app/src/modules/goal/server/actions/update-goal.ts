"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { Goal } from "@/models/Goal";
import { Project } from "@/models/Project";
import { Task } from "@/models/Task";
import { updateGoalSchema } from "@/modules/goal/schemas";
import { getWorkspaceForUser } from "@/modules/workspace/server/queries";
import { canEditTasks } from "@/modules/workspace/server/permissions";
import { isValidObjectId, parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { requireUser } from "@/modules/auth/server/session";
import type { ActionResult } from "@/lib/action-result";
import type { WorkspaceSummary } from "@/modules/workspace/server/dto";

type WorkspaceEditorAuth =
  | { ok: true; ws: WorkspaceSummary }
  | { ok: false; error: string };

async function getGoalForWorkspace(goalId: string, workspaceId: string) {
  await connectDB();
  return Goal.findOne({
    _id: parseObjectIdOrThrow(goalId),
    workspaceId: parseObjectIdOrThrow(workspaceId),
    isArchived: false,
  });
}

function revalidateGoals(slug: string) {
  revalidatePath(`/w/${slug}/strategy/goals`);
}

async function requireWorkspaceEditor(slug: string): Promise<WorkspaceEditorAuth> {
  const user = await requireUser();
  const ws = await getWorkspaceForUser(slug, user.id);
  if (!ws) return { ok: false, error: "Workspace not found." };
  if (!canEditTasks(ws.role)) return { ok: false, error: "You don't have permission." };
  return { ok: true, ws };
}

export async function updateGoalAction(
  slug: string,
  goalId: string,
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireWorkspaceEditor(slug);
  if (!auth.ok) return { ok: false, error: auth.error };

  const parsed = updateGoalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const goal = await getGoalForWorkspace(goalId, auth.ws.id);
  if (!goal) return { ok: false, error: "Goal not found." };

  const { dueDate, ...rest } = parsed.data;
  Object.assign(goal, rest);
  if (dueDate !== undefined) goal.dueDate = dueDate ? new Date(dueDate) : null;
  await goal.save();

  revalidateGoals(slug);
  return { ok: true, data: undefined };
}

export async function archiveGoalAction(
  slug: string,
  goalId: string,
): Promise<ActionResult<void>> {
  const auth = await requireWorkspaceEditor(slug);
  if (!auth.ok) return { ok: false, error: auth.error };

  await connectDB();
  await Goal.updateOne(
    { _id: parseObjectIdOrThrow(goalId), workspaceId: parseObjectIdOrThrow(auth.ws.id) },
    { isArchived: true },
  );

  revalidateGoals(slug);
  return { ok: true, data: undefined };
}

export async function linkGoalProjectAction(
  slug: string,
  goalId: string,
  projectId: string,
): Promise<ActionResult<void>> {
  const auth = await requireWorkspaceEditor(slug);
  if (!auth.ok) return { ok: false, error: auth.error };
  if (!isValidObjectId(projectId)) return { ok: false, error: "Invalid project." };

  const goal = await getGoalForWorkspace(goalId, auth.ws.id);
  if (!goal) return { ok: false, error: "Goal not found." };

  const project = await Project.findOne({
    _id: parseObjectIdOrThrow(projectId),
    workspaceId: parseObjectIdOrThrow(auth.ws.id),
    archivedAt: null,
  })
    .select("_id")
    .lean();
  if (!project) return { ok: false, error: "Project not found." };

  await Goal.updateOne(
    { _id: goal._id },
    { $addToSet: { linkedProjectIds: parseObjectIdOrThrow(projectId) } },
  );

  revalidateGoals(slug);
  return { ok: true, data: undefined };
}

export async function unlinkGoalProjectAction(
  slug: string,
  goalId: string,
  projectId: string,
): Promise<ActionResult<void>> {
  const auth = await requireWorkspaceEditor(slug);
  if (!auth.ok) return { ok: false, error: auth.error };
  if (!isValidObjectId(projectId)) return { ok: false, error: "Invalid project." };

  const goal = await getGoalForWorkspace(goalId, auth.ws.id);
  if (!goal) return { ok: false, error: "Goal not found." };

  await Goal.updateOne(
    { _id: goal._id },
    { $pull: { linkedProjectIds: parseObjectIdOrThrow(projectId) } },
  );

  revalidateGoals(slug);
  return { ok: true, data: undefined };
}

export async function linkGoalTaskAction(
  slug: string,
  goalId: string,
  taskId: string,
): Promise<ActionResult<void>> {
  const auth = await requireWorkspaceEditor(slug);
  if (!auth.ok) return { ok: false, error: auth.error };
  if (!isValidObjectId(taskId)) return { ok: false, error: "Invalid task." };

  const goal = await getGoalForWorkspace(goalId, auth.ws.id);
  if (!goal) return { ok: false, error: "Goal not found." };

  const task = await Task.findOne({
    _id: parseObjectIdOrThrow(taskId),
    workspaceId: parseObjectIdOrThrow(auth.ws.id),
    isArchived: false,
  })
    .select("_id projectId")
    .lean();
  if (!task) return { ok: false, error: "Task not found." };

  const project = await Project.findOne({
    _id: task.projectId,
    workspaceId: parseObjectIdOrThrow(auth.ws.id),
    archivedAt: null,
  })
    .select("_id")
    .lean();
  if (!project) return { ok: false, error: "Task project not found." };

  await Goal.updateOne(
    { _id: goal._id },
    { $addToSet: { linkedTaskIds: parseObjectIdOrThrow(taskId) } },
  );

  revalidateGoals(slug);
  return { ok: true, data: undefined };
}

export async function unlinkGoalTaskAction(
  slug: string,
  goalId: string,
  taskId: string,
): Promise<ActionResult<void>> {
  const auth = await requireWorkspaceEditor(slug);
  if (!auth.ok) return { ok: false, error: auth.error };
  if (!isValidObjectId(taskId)) return { ok: false, error: "Invalid task." };

  const goal = await getGoalForWorkspace(goalId, auth.ws.id);
  if (!goal) return { ok: false, error: "Goal not found." };

  await Goal.updateOne(
    { _id: goal._id },
    { $pull: { linkedTaskIds: parseObjectIdOrThrow(taskId) } },
  );

  revalidateGoals(slug);
  return { ok: true, data: undefined };
}
