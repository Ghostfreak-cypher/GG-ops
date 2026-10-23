import type { WorkspaceRole } from "@/modules/workspace/roles";

export type MemberProfileDTO = {
  id: string;
  userId: string;
  name: string;
  email: string;
  image: string | null;
  jobTitle: string | null;
  department: string | null;
  bio: string | null;
  pronounceUrl: string | null;
  outOfOfficeEnabled: boolean;
  outOfOfficeFrom: string | null;
  outOfOfficeUntil: string | null;
  outOfOfficeMessage: string | null;
  role: WorkspaceRole;
  joinedAt: string | null;
};

export type CollaboratorDTO = {
  userId: string;
  name: string;
  image: string | null;
  jobTitle: string | null;
  department: string | null;
  sharedTaskCount: number;
};

export type TaskSummaryDTO = {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  projectId: string;
  projectName: string;
  projectColor: string | null;
};

export type ProjectSummaryDTO = {
  id: string;
  name: string;
  color: string | null;
  memberCount: number;
};

export type TeamDTO = {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  color: string;
  isPrivate: boolean;
  memberIds: string[];
  leadIds: string[];
  members: Array<{
    userId: string;
    name: string;
    image: string | null;
    jobTitle: string | null;
    isLead: boolean;
  }>;
  memberCount: number;
  createdAt: string;
};
