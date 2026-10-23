import { isAtLeast, type WorkspaceRole } from "@/modules/workspace/roles";

export const canCreateProject = (role: WorkspaceRole) => isAtLeast(role, "MEMBER");
export const canInviteMembers = (role: WorkspaceRole) => isAtLeast(role, "ADMIN");
/**
 * The MAINTAINER role is permanent. A maintainer can never be demoted to ADMIN/MEMBER/GUEST —
 * not via member management, nor by accepting an invite to a workspace they already own.
 * (Transferring ownership would be a separate, deliberate action.)
 */
export const canChangeRole = (currentRole: WorkspaceRole) => currentRole !== "MAINTAINER";
export const canManageMembers = (role: WorkspaceRole) => isAtLeast(role, "ADMIN");
export const canDeleteWorkspace = (role: WorkspaceRole) => role === "MAINTAINER";
export const canArchiveProject = (role: WorkspaceRole) => isAtLeast(role, "ADMIN");
/** Create/edit sections, tasks, etc. — everyone except GUEST. */
export const canEditTasks = (role: WorkspaceRole) => isAtLeast(role, "MEMBER");
/** Create/delete workstreams (labels) — the shared taxonomy is admin-managed. */
export const canManageLabels = (role: WorkspaceRole) => isAtLeast(role, "ADMIN");

/** File the Daily Status Report — everyone who does delivery work, which is everyone but GUEST. */
export const canSubmitDsr = (role: WorkspaceRole) => isAtLeast(role, "MEMBER");

/**
 * Read the whole team's Daily Status Reports.
 *
 * Strictly narrower than `canSubmitDsr`: every reader is also a filer. The roster lists exactly
 * the people who can file, so a reader always has their own row on the page they're reading —
 * the team view holds them to the same reporting it shows them, and their own row can never be
 * a dead link. `permissions.test.ts` asserts the implication across every role.
 */
export const canViewAllDsr = (role: WorkspaceRole) => isAtLeast(role, "ADMIN");
