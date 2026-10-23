export const WORKSPACE_ROLES = ["MAINTAINER", "ADMIN", "MEMBER", "GUEST"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

/** Display labels for roles. The stored values are unchanged; this is presentation only. */
export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  MAINTAINER: "Maintainer",
  ADMIN: "Admin",
  MEMBER: "Member",
  GUEST: "Guest",
};

export const MEMBER_STATUSES = ["ACTIVE", "INVITED", "REMOVED"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

const RANK: Record<WorkspaceRole, number> = { GUEST: 0, MEMBER: 1, ADMIN: 2, MAINTAINER: 3 };

/** True when `role` is at least as privileged as `min` (MAINTAINER > ADMIN > MEMBER > GUEST). */
export function isAtLeast(role: WorkspaceRole, min: WorkspaceRole): boolean {
  return RANK[role] >= RANK[min];
}
