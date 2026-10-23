import { sendEmail } from "@/lib/email";
import {
  inviteEmail,
  mentionEmail,
  taskAssignedEmail,
  taskDueEmail,
  welcomeEmail,
  workspaceJoinedEmail,
  roleUpdatedEmail,
  taskCompletedEmail,
  taskOverdueEmail,
  newCommentEmail,
  memberJoinedEmail,
  emailVerificationEmail,
  passwordResetEmail,
  loginAlertEmail,
  passwordChangedEmail,
  dailyDigestEmail,
  weeklyDigestEmail,
} from "@/lib/jobs/templates";

export type JobPayloads = {
  "invite-email": {
    email: string;
    inviterName: string;
    workspaceName: string;
    inviteUrl: string;
    memberNames?: string[];
  };
  "mention-email": {
    email: string;
    by: string;
    taskTitle: string;
    taskUrl: string;
    preview?: string;
  };
  "task-assigned-email": {
    email: string;
    assignedBy: string;
    taskTitle: string;
    workspaceName: string;
    projectName: string;
    taskUrl: string;
    dueDate?: string;
  };
  "task-due-email": {
    email: string;
    taskTitle: string;
    workspaceName: string;
    projectName: string;
    taskUrl: string;
    dueDate: string;
  };
  "welcome-email": {
    email: string;
    name: string;
    appUrl: string;
  };
  "workspace-joined-email": {
    email: string;
    userName: string;
    workspaceName: string;
    workspaceUrl: string;
  };
  "role-updated-email": {
    email: string;
    userName: string;
    workspaceName: string;
    newRole: string;
    workspaceUrl: string;
  };
  "task-completed-email": {
    email: string;
    completedBy: string;
    taskTitle: string;
    workspaceName: string;
    projectName: string;
    taskUrl: string;
  };
  "task-overdue-email": {
    email: string;
    taskTitle: string;
    workspaceName: string;
    projectName: string;
    taskUrl: string;
    dueDate: string;
  };
  "new-comment-email": {
    email: string;
    commenterName: string;
    taskTitle: string;
    taskUrl: string;
    preview?: string;
  };
  "member-joined-email": {
    email: string;
    memberName: string;
    workspaceName: string;
    workspaceUrl: string;
    role: string;
  };
  "email-verification-email": {
    email: string;
    name: string;
    verifyUrl: string;
  };
  "password-reset-email": {
    email: string;
    name: string;
    resetUrl: string;
  };
  "login-alert-email": {
    email: string;
    name: string;
    provider: string;
    occurredAt: string;
    ipAddress: string;
    userAgent: string;
    securityUrl: string;
  };
  "password-changed-email": {
    email: string;
    name: string;
    securityUrl: string;
  };
  "daily-digest-email": {
    email: string;
    userName: string;
    workspaceName: string;
    workspaceUrl: string;
    tasksDueToday: Array<{ title: string; projectName: string; taskUrl: string }>;
    overdueCount: number;
  };
  "weekly-digest-email": {
    email: string;
    userName: string;
    workspaceName: string;
    workspaceUrl: string;
    completedThisWeek: number;
    openTasks: number;
    overdueTasks: number;
    overdueList: Array<{ title: string; projectName: string }>;
    topMembers: Array<{ name: string; count: number }>;
  };
};

export const jobHandlers: {
  [K in keyof JobPayloads]: (p: JobPayloads[K]) => Promise<void>;
} = {
  "invite-email": async (p) => {
    await sendEmail({ to: p.email, ...inviteEmail(p) });
  },
  "mention-email": async (p) => {
    await sendEmail({ to: p.email, ...mentionEmail(p) });
  },
  "task-assigned-email": async (p) => {
    await sendEmail({ to: p.email, ...taskAssignedEmail(p) });
  },
  "task-due-email": async (p) => {
    await sendEmail({ to: p.email, ...taskDueEmail(p) });
  },
  "welcome-email": async (p) => {
    await sendEmail({ to: p.email, ...welcomeEmail(p) });
  },
  "workspace-joined-email": async (p) => {
    await sendEmail({ to: p.email, ...workspaceJoinedEmail(p) });
  },
  "role-updated-email": async (p) => {
    await sendEmail({ to: p.email, ...roleUpdatedEmail(p) });
  },
  "task-completed-email": async (p) => {
    await sendEmail({ to: p.email, ...taskCompletedEmail(p) });
  },
  "task-overdue-email": async (p) => {
    await sendEmail({ to: p.email, ...taskOverdueEmail(p) });
  },
  "new-comment-email": async (p) => {
    await sendEmail({ to: p.email, ...newCommentEmail(p) });
  },
  "member-joined-email": async (p) => {
    await sendEmail({ to: p.email, ...memberJoinedEmail(p) });
  },
  "email-verification-email": async (p) => {
    await sendEmail({ to: p.email, ...emailVerificationEmail(p) });
  },
  "password-reset-email": async (p) => {
    await sendEmail({ to: p.email, ...passwordResetEmail(p) });
  },
  "login-alert-email": async (p) => {
    await sendEmail({ to: p.email, ...loginAlertEmail(p) });
  },
  "password-changed-email": async (p) => {
    await sendEmail({ to: p.email, ...passwordChangedEmail(p) });
  },
  "daily-digest-email": async (p) => {
    await sendEmail({ to: p.email, ...dailyDigestEmail(p) });
  },
  "weekly-digest-email": async (p) => {
    await sendEmail({ to: p.email, ...weeklyDigestEmail(p) });
  },
};
