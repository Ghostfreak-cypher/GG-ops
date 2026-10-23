import { format } from "date-fns";
import { enqueue } from "@/lib/queue";
import { absoluteUrl } from "@/lib/urls";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { canSendWorkspaceEmail } from "@/lib/notification-preferences";
import { Project } from "@/models/Project";
import { User } from "@/models/User";
import { Workspace } from "@/models/Workspace";

export type TaskEmailContext = {
  workspaceId: string;
  projectId: string;
  taskId: string;
  taskTitle: string;
  assigneeIds: string[];
  dueDate?: Date | string | null;
};

function formatDueDate(date: Date | string): string {
  return format(new Date(date), "MMM d, yyyy");
}

async function getTaskEmailMetadata(workspaceId: string, projectId: string) {
  const [workspace, project] = await Promise.all([
    Workspace.findById(parseObjectIdOrThrow(workspaceId)).select("name slug").lean(),
    Project.findById(parseObjectIdOrThrow(projectId)).select("name").lean(),
  ]);

  if (!workspace || !project) return null;
  return {
    workspaceName: workspace.name,
    workspaceSlug: workspace.slug,
    projectName: project.name,
  };
}

export async function enqueueTaskAssignedEmails(
  task: TaskEmailContext,
  assignedBy: string,
): Promise<void> {
  if (task.assigneeIds.length === 0) return;

  const metadata = await getTaskEmailMetadata(task.workspaceId, task.projectId);
  if (!metadata) return;

  const assignees = await User.find({
    _id: { $in: task.assigneeIds.map((id) => parseObjectIdOrThrow(id)) },
    isActive: true,
  })
    .select("_id email")
    .lean();

  const taskUrl = absoluteUrl(
    `/w/${metadata.workspaceSlug}/projects/${task.projectId}/tasks/${task.taskId}`,
  );
  const dueDate = task.dueDate ? formatDueDate(task.dueDate) : undefined;

  for (const assignee of assignees) {
    if (!assignee.email) continue;
    if (!(await canSendWorkspaceEmail(String(assignee._id), task.workspaceId, "TASK_ASSIGNED"))) continue;
    enqueue("task-assigned-email", {
      email: assignee.email,
      assignedBy,
      taskTitle: task.taskTitle,
      workspaceName: metadata.workspaceName,
      projectName: metadata.projectName,
      taskUrl,
      dueDate,
    });
  }
}

export async function enqueueTaskCompletedEmails(
  task: TaskEmailContext & { createdBy: string },
  completedBy: string,
  completedById: string,
): Promise<void> {
  const metadata = await getTaskEmailMetadata(task.workspaceId, task.projectId);
  if (!metadata) return;

  const recipientIds = [...new Set([task.createdBy, ...(task.assigneeIds ?? [])])].filter(
    (id) => id !== completedById,
  );
  if (recipientIds.length === 0) return;

  const users = await User.find({
    _id: { $in: recipientIds.map((id) => parseObjectIdOrThrow(id)) },
    isActive: true,
  })
    .select("_id email")
    .lean();

  const taskUrl = absoluteUrl(
    `/w/${metadata.workspaceSlug}/projects/${task.projectId}/tasks/${task.taskId}`,
  );

  for (const u of users) {
    if (!u.email) continue;
    if (!(await canSendWorkspaceEmail(String(u._id), task.workspaceId, "TASK_COMPLETED"))) continue;
    enqueue("task-completed-email", {
      email: u.email,
      completedBy,
      taskTitle: task.taskTitle,
      workspaceName: metadata.workspaceName,
      projectName: metadata.projectName,
      taskUrl,
    });
  }
}

export async function enqueueNewCommentEmails(
  task: TaskEmailContext & { createdBy: string },
  commenterName: string,
  commenterId: string,
  preview?: string,
): Promise<void> {
  const metadata = await getTaskEmailMetadata(task.workspaceId, task.projectId);
  if (!metadata) return;

  const recipientIds = [...new Set([task.createdBy, ...(task.assigneeIds ?? [])])].filter(
    (id) => id !== commenterId,
  );
  if (recipientIds.length === 0) return;

  const users = await User.find({
    _id: { $in: recipientIds.map((id) => parseObjectIdOrThrow(id)) },
    isActive: true,
  })
    .select("_id email")
    .lean();

  const taskUrl = absoluteUrl(
    `/w/${metadata.workspaceSlug}/projects/${task.projectId}/tasks/${task.taskId}`,
  );

  for (const u of users) {
    if (!u.email) continue;
    if (!(await canSendWorkspaceEmail(String(u._id), task.workspaceId, "TASK_COMMENTED"))) continue;
    enqueue("new-comment-email", {
      email: u.email,
      commenterName,
      taskTitle: task.taskTitle,
      taskUrl,
      preview,
    });
  }
}

export async function enqueueTaskDueEmails(
  task: Required<TaskEmailContext>,
  event: "TASK_DUE" | "TASK_DUE_TOMORROW" | "TASK_OVERDUE" = "TASK_DUE",
): Promise<number> {
  if (task.assigneeIds.length === 0) return 0;

  const metadata = await getTaskEmailMetadata(task.workspaceId, task.projectId);
  if (!metadata) return 0;

  const assignees = await User.find({
    _id: { $in: task.assigneeIds.map((id) => parseObjectIdOrThrow(id)) },
    isActive: true,
  })
    .select("_id email")
    .lean();

  const taskUrl = absoluteUrl(
    `/w/${metadata.workspaceSlug}/projects/${task.projectId}/tasks/${task.taskId}`,
  );
  const dueDate = task.dueDate ? formatDueDate(task.dueDate) : "today";
  let queued = 0;

  for (const assignee of assignees) {
    if (!assignee.email) continue;
    if (!(await canSendWorkspaceEmail(String(assignee._id), task.workspaceId, event))) continue;
    enqueue("task-due-email", {
      email: assignee.email,
      taskTitle: task.taskTitle,
      workspaceName: metadata.workspaceName,
      projectName: metadata.projectName,
      taskUrl,
      dueDate,
    });
    queued += 1;
  }

  return queued;
}
