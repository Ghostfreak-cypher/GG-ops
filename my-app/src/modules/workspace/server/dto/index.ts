import type { WorkspaceRole, MemberStatus } from "@/modules/workspace/roles";

export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
};

export type MemberDTO = {
  id: string;
  userId: string;
  name: string;
  email: string;
  image: string | null;
  jobTitle: string | null;
  role: WorkspaceRole;
  status: MemberStatus;
  joinedAt: string | null;
};

export type PendingInviteDTO = {
  id: string;
  email: string;
  role: WorkspaceRole;
  expiresAt: string;
  daysLeft: number;
  createdAt: string;
  invitedByName: string | null;
  inviteUrl: string;
};
