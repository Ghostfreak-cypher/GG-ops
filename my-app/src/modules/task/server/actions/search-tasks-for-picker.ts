"use server";

import { getProjectForUser } from "@/modules/project/server/access";
import { getWorkspaceForUser } from "@/modules/workspace/server/queries";
import { searchTasks } from "@/modules/task/server/queries";
import { requireUser } from "@/modules/auth/server/session";

export async function searchTasksForPickerAction(
  query: string,
  projectId: string,
): Promise<{ id: string; title: string; projectId: string; projectName: string }[]> {
  const user = await requireUser();
  if (!user) return [];

  const access = await getProjectForUser(projectId, user.id);
  if (!access) return [];

  return searchTasks(access.project.workspaceId, query, projectId);
}

export async function searchWorkspaceTasksForPickerAction(
  workspaceSlug: string,
  query: string,
  projectId?: string,
): Promise<{ id: string; title: string; projectId: string; projectName: string }[]> {
  const user = await requireUser();
  if (!user) return [];

  const workspace = await getWorkspaceForUser(workspaceSlug, user.id);
  if (!workspace) return [];

  return searchTasks(workspace.id, query, projectId);
}
