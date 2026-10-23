export const WORKSPACE_EMAIL_EVENTS = [
  "INVITE",
  "WORKSPACE_JOINED",
  "ROLE_UPDATED",
  "TASK_ASSIGNED",
  "TASK_DUE",
  "TASK_DUE_TOMORROW",
  "TASK_OVERDUE",
  "TASK_COMPLETED",
  "TASK_COMMENTED",
  "COMMENT_MENTION",
  "MEMBER_JOINED",
  "DIGEST_DAILY",
  "DIGEST_WEEKLY",
] as const;

export const WORKSPACE_EMAIL_FREQUENCIES = ["OFF", "IMMEDIATE", "DAILY", "WEEKLY"] as const;

export type WorkspaceEmailEvent = (typeof WORKSPACE_EMAIL_EVENTS)[number];
export type WorkspaceEmailFrequency = (typeof WORKSPACE_EMAIL_FREQUENCIES)[number];

export const WORKSPACE_EMAIL_EVENT_LABELS: Record<WorkspaceEmailEvent, string> = {
  INVITE: "Workspace invitations",
  WORKSPACE_JOINED: "Workspace joined",
  ROLE_UPDATED: "Role updates",
  TASK_ASSIGNED: "Task assignments",
  TASK_DUE: "Tasks due today",
  TASK_DUE_TOMORROW: "Tasks due tomorrow",
  TASK_OVERDUE: "Overdue tasks",
  TASK_COMPLETED: "Task completed",
  TASK_COMMENTED: "New comments",
  COMMENT_MENTION: "Comment mentions",
  MEMBER_JOINED: "Member joined",
  DIGEST_DAILY: "Daily digest",
  DIGEST_WEEKLY: "Weekly digest",
};
