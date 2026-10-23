import type { TaskStatus, TaskPriority, TaskType } from "@/modules/task/constants";

export type TaskAssignee = { id: string; name: string; image: string | null };

export type TaskDTO = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  type: TaskType;
  sectionId: string | null;
  position: number;
  dueDate: string | null;
  startDate: string | null;
  assignees: TaskAssignee[];
  labelIds: string[];
  commentCount: number;
  attachmentCount: number;
  /** Number of unresolved blocking dependencies. Non-zero means this task is blocked. */
  blockedByCount: number;
  recurrenceRule: string | null;
  recurrenceParentId: string | null;
};

export type LabelLite = { id: string; name: string; color: string | null };

/** Full task detail: the task plus its resolved labels and direct subtasks. */
export type TaskDetailDTO = TaskDTO & {
  parentTaskId: string | null;
  labels: LabelLite[];
  subtasks: TaskDTO[];
};

export type BoardSection = {
  id: string;
  name: string;
  position: number;
  tasks: TaskDTO[];
};

export type ProjectStatusColor = "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "ON_HOLD";

export type BoardData = {
  projectId: string;
  projectName: string;
  projectDescription: string | null;
  projectColor: string | null;
  projectIcon: string | null;
  projectStatusColor: ProjectStatusColor | null;
  projectStatusNote: string | null;
  projectStatusUpdatedAt: string | null;
  memberCount: number;
  sections: BoardSection[];
  unsectioned: TaskDTO[];
};
