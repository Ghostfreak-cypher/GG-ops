/**
 * Task creation, decoupled from the request context.
 *
 * ⚠️ THIS FILE MUST NOT CARRY THE `"use server"` DIRECTIVE. ⚠️
 *
 * Next exposes *every* export of a `"use server"` module as an unauthenticated POST
 * endpoint. `createTaskForActor` takes the actor as a parameter, so if this file were a
 * Server Action module it would be a public impersonation endpoint — anyone could create
 * tasks as any user. It is a plain server module: importable from Server Actions, route
 * handlers, MCP tools, and cron jobs, reachable from the network only through one of those.
 * `src/modules/task/server/create-task-core.test.ts` asserts the directive is absent.
 *
 * Callers that DO have a request context should keep using `createTaskAction` — it is the
 * authenticated wrapper around this function. Reach for `createTaskForActor` only where
 * there is no session to read: the inbound-email cron (V5) establishes its actor by
 * verifying the sender's DMARC-authenticated address against an active `User`.
 *
 * Authorization is NOT skipped here. `getProjectForUser(projectId, actor.id)` +
 * `canEditTasks(role)` still run, so an actor who isn't an ACTIVE member of the project's
 * workspace is rejected exactly as an HTTP caller would be.
 */

import { connectDB } from "@/lib/db";
import { Task } from "@/models/Task";
import { createTaskSchema } from "@/modules/task/schemas";
import { getProjectForUser, assertSectionInProject } from "@/modules/project/server/access";
import { canEditTasks } from "@/modules/workspace/server/permissions";
import { nextPosition } from "@/modules/task/position";
import { invalidTaskRef } from "@/modules/task/server/task-refs";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { logActivity } from "@/modules/activity/log";
import { enqueueTaskAssignedEmails } from "@/lib/jobs/task-email";
import { publish } from "@/lib/pusher";
import { notify } from "@/modules/notification/server/create";
import { notifyDescriptionMentions } from "@/modules/task/server/description-mentions";
import type { ActionResult } from "@/lib/action-result";

/** Who the task is created as. `name` is already defaulted by the caller. */
export type TaskActor = { id: string; name: string };

export async function createTaskForActor(
  actor: TaskActor,
  projectId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const access = await getProjectForUser(projectId, actor.id);
  if (!access) return { ok: false, error: "Project not found." };
  if (!canEditTasks(access.role)) return { ok: false, error: "You don't have permission." };

  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  if (d.sectionId && !(await assertSectionInProject(d.sectionId, projectId))) {
    return { ok: false, error: "Section does not belong to this project." };
  }

  await connectDB();
  const pid = parseObjectIdOrThrow(projectId);
  const workspaceId = parseObjectIdOrThrow(access.project.workspaceId);
  const sectionId = d.sectionId ? parseObjectIdOrThrow(d.sectionId) : null;

  const assigneeIds = d.assigneeIds ?? [];
  const assigneeOids = assigneeIds.map((id) => parseObjectIdOrThrow(id));
  const labelOids = (d.labelIds ?? []).map((id) => parseObjectIdOrThrow(id));
  const parentTaskId = d.parentTaskId ? parseObjectIdOrThrow(d.parentTaskId) : null;
  const refError = await invalidTaskRef(workspaceId, {
    assigneeIds: assigneeOids,
    labelIds: labelOids,
    parent: parentTaskId ? { taskId: parentTaskId, projectId: pid } : undefined,
  });
  if (refError) return { ok: false, error: refError };

  // nextPosition only needs the highest sibling position; the board index serves it directly.
  const last = await Task.findOne({ workspaceId, projectId: pid, sectionId, isArchived: false })
    .sort({ position: -1 })
    .select("position")
    .lean();

  const task = await Task.create({
    workspaceId,
    projectId: pid,
    sectionId,
    title: d.title,
    description: d.description ?? null,
    status: d.status ?? "TODO",
    priority: d.priority ?? "MEDIUM",
    type: d.type ?? "TASK",
    dueDate: d.dueDate ?? null,
    assigneeIds: assigneeOids,
    labelIds: labelOids,
    parentTaskId,
    createdBy: parseObjectIdOrThrow(actor.id),
    position: nextPosition(last ? [last.position ?? 0] : []),
  });

  await logActivity({
    workspaceId: access.project.workspaceId,
    projectId,
    taskId: String(task._id),
    actorId: actor.id,
    action: "TASK_CREATED",
  });

  await publish(`project-${projectId}`, "task.changed", { projectId });

  await enqueueTaskAssignedEmails(
    {
      workspaceId: access.project.workspaceId,
      projectId,
      taskId: String(task._id),
      taskTitle: task.title,
      assigneeIds: assigneeIds.filter((id) => id !== actor.id),
      dueDate: task.dueDate,
    },
    actor.name,
  );

  if (d.description) {
    await notifyDescriptionMentions({
      workspaceId: access.project.workspaceId,
      taskId: String(task._id),
      taskTitle: task.title,
      actorId: actor.id,
      actorName: actor.name,
      description: d.description,
    });
  }

  const notifyIds = assigneeIds.filter((id) => id !== actor.id);
  if (notifyIds.length > 0) {
    await notify(
      notifyIds.map((userId) => ({
        userId,
        workspaceId: access.project.workspaceId,
        type: "TASK_ASSIGNED",
        title: `${actor.name} assigned "${task.title}"`,
        entityType: "TASK",
        entityId: String(task._id),
      })),
    );
  }

  return { ok: true, data: { id: String(task._id) } };
}
