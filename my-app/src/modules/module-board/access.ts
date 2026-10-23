import { cache } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/modules/auth/server/session";
import { getWorkspaceForUser } from "@/modules/workspace/server/queries";
import type { WorkspaceRole } from "@/modules/workspace/roles";
import { isAtLeast } from "@/modules/workspace/roles";

export type ModuleBoardWorkspaceAccess = {
  workspace: { id: string; name: string; slug: string };
  role: WorkspaceRole;
  userId: string;
};

export const requireModuleBoardWorkspace = cache(
  async (workspaceSlug: string): Promise<ModuleBoardWorkspaceAccess> => {
    const user = await requireUser();
    const workspace = await getWorkspaceForUser(workspaceSlug, user.id);
    if (!workspace) notFound();

    return {
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
      },
      role: workspace.role,
      userId: user.id,
    };
  },
);

export const canEditModuleBoard = (role: WorkspaceRole) => isAtLeast(role, "MEMBER");
