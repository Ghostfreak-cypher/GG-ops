"use server";

import { connectDB } from "@/lib/db";
import { Task } from "@/models/Task";
import { updateTaskSchema } from "@/modules/task/schemas";
import { getProjectForUser, assertSectionInProject } from "@/modules/project/server/access";
import { canEditTasks } from "@/modules/workspace/server/permissions";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { invalidTaskRef } from "@/modules/task/server/task-refs";
import { requireUser } from "@/modules/auth/server/session";
import { logActivity } from "@/modules/activity/log";
import { enqueueTaskAssignedEmails, enqueueTaskCompletedEmails } from "@/lib/jobs/task-email";
import { publish } from "@/lib/pusher";
import { notify } from "@/modules/notification/server/create";
import { getTaskFollowers } from "@/modules/task/server/queries/follows";
import { notifyDescriptionMentions } from "@/modules/task/server/description-mentions";
import type { ActionResult } from "@/lib/action-result";

export async function updateTaskAction(
  taskId: string,
  input: unknown,
): Promise<ActionResult> {
  const user = await requireUser();
  await connectDB();

  const task = await Task.findById(parseObjectIdOrThrow(taskId));
  if (!task) return { ok: false, error: "Task not found." };

  const access = await getProjectForUser(String(task.projectId), user.id);
  if (!access) return { ok: false, error: "Not allowed." };
  if (!canEditTasks(access.role)) return { ok: false, error: "You don't have permission." };

  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  if (d.sectionId && !(await assertSectionInProject(d.sectionId, String(task.projectId)))) {
    return { ok: false, error: "Section does not belong to this project." };
  }

  const previousAssigneeIds = new Set((task.assigneeIds ?? []).map((id) => String(id)));
  const previousLabelIds = new Set((task.labelIds ?? []).map((id) => String(id)));
  // Only ids being added are checked, so a member who has since left can stay assigned.
  const refError = await invalidTaskRef(task.workspaceId, {
    assigneeIds: d.assigneeIds
      ?.filter((id) => !previousAssigneeIds.has(id))
      .map((id) => parseObjectIdOrThrow(id)),
    labelIds: d.labelIds
      ?.filter((id) => !previousLabelIds.has(id))
      .map((id) => parseObjectIdOrThrow(id)),
  });
  if (refError) return { ok: false, error: refError };
  const previousDescription = task.description ?? "";
  let newlyAssignedIds: string[] = [];

  if (d.title !== undefined) task.title = d.title;
  if (d.description !== undefined) task.description = d.description;
  if (d.status !== undefined) {
    task.status = d.status;
    task.completedAt = d.status === "DONE" ? new Date() : null;
  }
  if (d.priority !== undefined) task.priority = d.priority;
  if (d.type !== undefined) task.type = d.type;
  if (d.dueDate !== undefined) task.dueDate = d.dueDate;
  if (d.startDate !== undefined) task.startDate = d.startDate;
  if (d.assigneeIds !== undefined) {
    newlyAssignedIds = d.assigneeIds.filter(
      (id) => !previousAssigneeIds.has(id) && id !== user.id,
    );
    task.assigneeIds = d.assigneeIds.map((id) => parseObjectIdOrThrow(id));
  }
  if (d.labelIds !== undefined) {
    task.labelIds = d.labelIds.map((id) => parseObjectIdOrThrow(id));
  }
  if (d.sectionId !== undefined) {
    task.sectionId = d.sectionId ? parseObjectIdOrThrow(d.sectionId) : null;
  }
  if (d.recurrenceRule !== undefined) {
    (task as unknown as { recurrenceRule: string | null }).recurrenceRule = d.recurrenceRule;
  }
  task.updatedBy = parseObjectIdOrThrow(user.id);

  await task.save();
  await logActivity({
    workspaceId: access.project.workspaceId,
    projectId: String(task.projectId),
    taskId,
    actorId: user.id,
    action: d.status === "DONE" ? "TASK_COMPLETED" : "TASK_UPDATED",
  });

  await publish(`project-${String(task.projectId)}`, "task.changed", {
    projectId: String(task.projectId),
  });

  if (d.description !== undefined && (d.description ?? "") !== previousDescription) {
    await notifyDescriptionMentions({
      workspaceId: access.project.workspaceId,
      taskId,
      taskTitle: task.title,
      actorId: user.id,
      actorName: user.name ?? "Someone",
      description: d.description ?? "",
      previousDescription,
    });
  }

  await enqueueTaskAssignedEmails(
    {
      workspaceId: access.project.workspaceId,
      projectId: String(task.projectId),
      taskId,
      taskTitle: task.title,
      assigneeIds: newlyAssignedIds,
      dueDate: task.dueDate,
    },
    user.name ?? "Someone",
  );

  if (newlyAssignedIds.length > 0) {
    const followers = await getTaskFollowers(access.project.workspaceId, taskId);
    const recipientIds = [...new Set([...newlyAssignedIds, ...followers])].filter(
      (id) => id !== user.id,
    );
    if (recipientIds.length > 0) {
      await notify(
        recipientIds.map((userId) => ({
          userId,
          workspaceId: access.project.workspaceId,
          type: "TASK_ASSIGNED",
          title: `${user.name ?? "Someone"} assigned "${task.title}"`,
          entityType: "TASK",
          entityId: taskId,
        })),
      );
    }
  }

  if (d.status === "DONE") {
    await enqueueTaskCompletedEmails(
      {
        workspaceId: access.project.workspaceId,
        projectId: String(task.projectId),
        taskId,
        taskTitle: task.title,
        assigneeIds: (task.assigneeIds ?? []).map(String),
        createdBy: String(task.createdBy),
      },
      user.name ?? "Someone",
      user.id,
    );
  }

  return { ok: true };
}
