import { connectDB } from "@/lib/db";
import { Task } from "@/models/Task";
import { Notification } from "@/models/Notification";
import { WorkspaceInvite } from "@/models/WorkspaceInvite";
import { notify, type NotificationInput } from "@/modules/notification/server/create";
import { enqueueTaskDueEmails } from "@/lib/jobs/task-email";

/** Create TASK_DUE notifications for tasks due today. Idempotent within a day. */
export async function generateDueReminders(): Promise<{ created: number; emailsQueued: number }> {
  await connectDB();
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 3600 * 1000);

  const tasks = await Task.find({
    isArchived: false,
    status: { $ne: "DONE" },
    dueDate: { $gte: start, $lt: end },
    assigneeIds: { $exists: true, $ne: [] },
  })
    .select("title workspaceId projectId assigneeIds dueDate")
    .lean();
  if (tasks.length === 0) return { created: 0, emailsQueued: 0 };

  const taskIds = tasks.map((t) => t._id);
  const existing = await Notification.find({
    type: "TASK_DUE",
    entityId: { $in: taskIds },
    createdAt: { $gte: start },
  })
    .select("userId entityId")
    .lean();
  const seen = new Set(existing.map((e) => `${String(e.userId)}:${String(e.entityId)}`));

  const toCreate: NotificationInput[] = [];
  const dueEmailTasks = [] as Array<{
    workspaceId: string;
    projectId: string;
    taskId: string;
    taskTitle: string;
    assigneeIds: string[];
    dueDate: Date;
  }>;

  for (const t of tasks) {
    const freshAssigneeIds: string[] = [];
    for (const uid of t.assigneeIds ?? []) {
      const key = `${String(uid)}:${String(t._id)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      freshAssigneeIds.push(String(uid));
      toCreate.push({
        userId: String(uid),
        workspaceId: String(t.workspaceId),
        type: "TASK_DUE",
        title: `Due today: ${t.title}`,
        entityType: "TASK",
        entityId: String(t._id),
      });
    }

    if (freshAssigneeIds.length > 0 && t.dueDate) {
      dueEmailTasks.push({
        workspaceId: String(t.workspaceId),
        projectId: String(t.projectId),
        taskId: String(t._id),
        taskTitle: t.title,
        assigneeIds: freshAssigneeIds,
        dueDate: t.dueDate,
      });
    }
  }

  await notify(toCreate);
  let emailsQueued = 0;
  for (const task of dueEmailTasks) {
    emailsQueued += await enqueueTaskDueEmails(task);
  }

  return { created: toCreate.length, emailsQueued };
}

/** Create TASK_OVERDUE notifications + emails for tasks past their due date. Idempotent per day. */
export async function generateOverdueReminders(): Promise<{ created: number; emailsQueued: number }> {
  await connectDB();
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const tasks = await Task.find({
    isArchived: false,
    status: { $ne: "DONE" },
    dueDate: { $lt: todayStart },
    assigneeIds: { $exists: true, $ne: [] },
  })
    .select("title workspaceId projectId assigneeIds dueDate")
    .lean();
  if (tasks.length === 0) return { created: 0, emailsQueued: 0 };

  const taskIds = tasks.map((t) => t._id);
  const existing = await Notification.find({
    type: "TASK_OVERDUE",
    entityId: { $in: taskIds },
    createdAt: { $gte: todayStart },
  })
    .select("userId entityId")
    .lean();
  const seen = new Set(existing.map((e) => `${String(e.userId)}:${String(e.entityId)}`));

  const toCreate: NotificationInput[] = [];
  const overdueEmailTasks: Array<{
    workspaceId: string;
    projectId: string;
    taskId: string;
    taskTitle: string;
    assigneeIds: string[];
    dueDate: Date;
  }> = [];

  for (const t of tasks) {
    const freshAssigneeIds: string[] = [];
    for (const uid of t.assigneeIds ?? []) {
      const key = `${String(uid)}:${String(t._id)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      freshAssigneeIds.push(String(uid));
      toCreate.push({
        userId: String(uid),
        workspaceId: String(t.workspaceId),
        type: "TASK_OVERDUE",
        title: `Overdue: ${t.title}`,
        entityType: "TASK",
        entityId: String(t._id),
      });
    }
    if (freshAssigneeIds.length > 0 && t.dueDate) {
      overdueEmailTasks.push({
        workspaceId: String(t.workspaceId),
        projectId: String(t.projectId),
        taskId: String(t._id),
        taskTitle: t.title,
        assigneeIds: freshAssigneeIds,
        dueDate: t.dueDate,
      });
    }
  }

  await notify(toCreate);
  let emailsQueued = 0;
  for (const task of overdueEmailTasks) {
    emailsQueued += await enqueueTaskDueEmails({ ...task, dueDate: task.dueDate });
  }

  return { created: toCreate.length, emailsQueued };
}

/** Create TASK_DUE_TOMORROW notifications + emails for tasks due the next calendar day. Idempotent per day. */
export async function generateDueTomorrowReminders(): Promise<{ created: number; emailsQueued: number }> {
  await connectDB();
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 3600 * 1000);
  const tomorrowEnd = new Date(tomorrowStart.getTime() + 24 * 3600 * 1000);

  const tasks = await Task.find({
    isArchived: false,
    status: { $ne: "DONE" },
    dueDate: { $gte: tomorrowStart, $lt: tomorrowEnd },
    assigneeIds: { $exists: true, $ne: [] },
  })
    .select("title workspaceId projectId assigneeIds dueDate")
    .lean();
  if (tasks.length === 0) return { created: 0, emailsQueued: 0 };

  const taskIds = tasks.map((t) => t._id);
  const existing = await Notification.find({
    type: "TASK_DUE_TOMORROW",
    entityId: { $in: taskIds },
    createdAt: { $gte: todayStart },
  })
    .select("userId entityId")
    .lean();
  const seen = new Set(existing.map((e) => `${String(e.userId)}:${String(e.entityId)}`));

  const toCreate: NotificationInput[] = [];
  const tomorrowEmailTasks: Array<{
    workspaceId: string;
    projectId: string;
    taskId: string;
    taskTitle: string;
    assigneeIds: string[];
    dueDate: Date;
  }> = [];

  for (const t of tasks) {
    const freshAssigneeIds: string[] = [];
    for (const uid of t.assigneeIds ?? []) {
      const key = `${String(uid)}:${String(t._id)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      freshAssigneeIds.push(String(uid));
      toCreate.push({
        userId: String(uid),
        workspaceId: String(t.workspaceId),
        type: "TASK_DUE_TOMORROW",
        title: `Due tomorrow: ${t.title}`,
        entityType: "TASK",
        entityId: String(t._id),
      });
    }
    if (freshAssigneeIds.length > 0 && t.dueDate) {
      tomorrowEmailTasks.push({
        workspaceId: String(t.workspaceId),
        projectId: String(t.projectId),
        taskId: String(t._id),
        taskTitle: t.title,
        assigneeIds: freshAssigneeIds,
        dueDate: t.dueDate,
      });
    }
  }

  await notify(toCreate);
  let emailsQueued = 0;
  for (const task of tomorrowEmailTasks) {
    emailsQueued += await enqueueTaskDueEmails({ ...task, dueDate: task.dueDate });
  }

  return { created: toCreate.length, emailsQueued };
}

/** Remove invites that expired without being accepted. */
export async function cleanupExpiredInvites(): Promise<{ removed: number }> {
  await connectDB();
  const res = await WorkspaceInvite.deleteMany({
    acceptedAt: null,
    expiresAt: { $lt: new Date() },
  });
  return { removed: res.deletedCount ?? 0 };
}
