import { cache } from "react";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { env } from "@/lib/env";
import { Workspace } from "@/models/Workspace";
import { WorkspaceMember } from "@/models/WorkspaceMember";
import { requireUser } from "@/modules/auth/server/session";
import type { WorkspaceRole } from "@/modules/workspace/roles";

export type FinanceWorkspaceAccess = {
  workspace: { id: string; name: string; slug: string };
  role: WorkspaceRole;
  userId: string;
};

/**
 * Resolves the single private finance workspace (FINANCE_WORKSPACE_SLUG) and verifies the
 * current user is an ACTIVE member. Call from every spend-report page/action — never trust
 * a client-sent workspaceId for this feature.
 */
export const requireFinanceWorkspace = cache(async (): Promise<FinanceWorkspaceAccess> => {
  const user = await requireUser();

  // Guard explicitly: an unset slug must never fall through to an unfiltered query
  // (Workspace.findOne({ slug: undefined }) would match the first workspace in the collection).
  const financeSlug = env.FINANCE_WORKSPACE_SLUG;
  if (!financeSlug) notFound();

  await connectDB();
  const workspace = await Workspace.findOne({ slug: financeSlug }).lean();
  if (!workspace) notFound();

  const membership = await WorkspaceMember.findOne({
    workspaceId: workspace._id,
    userId: user.id,
    status: "ACTIVE",
  }).lean();
  if (!membership) notFound();

  return {
    workspace: { id: String(workspace._id), name: workspace.name, slug: workspace.slug },
    role: membership.role as WorkspaceRole,
    userId: user.id,
  };
});

/** All ACTIVE finance-workspace members can create/edit reports equally. */
export const canEditSpendReport = (_role: WorkspaceRole) => true;
/** Deleting a report is restricted to the workspace MAINTAINER. */
export const canDeleteSpendReport = (role: WorkspaceRole) => role === "MAINTAINER";
