import { notFound } from "next/navigation";
import { requireUser } from "@/modules/auth/server/session";
import { getProjectForUser } from "@/modules/project/server/access";
import { getProjectBoard } from "@/modules/task/server/queries";
import { listMembers } from "@/modules/workspace/server/queries";
import { listLabels } from "@/modules/label/server/queries";
import { canEditTasks, canManageLabels, canArchiveProject } from "@/modules/workspace/server/permissions";
import { ProjectWorkspace } from "../project-workspace";
import { parseUrlFilters } from "@/modules/task/parse-url-filters";
import { listSavedViews } from "@/modules/saved-view/server/queries";

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string; projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { workspaceSlug, projectId } = await params;
  const user = await requireUser();

  // Independent checks: getProjectBoard re-derives access itself (via the cache()d
  // getProjectForUser), rather than depending on `access`. No card on this page renders a
  // description, so the board fetch also skips it.
  const [access, board] = await Promise.all([
    getProjectForUser(projectId, user.id),
    getProjectBoard(projectId, user.id, {}, false),
  ]);
  if (!access) notFound();
  if (!board) notFound();

  const editable = canEditTasks(access.role);
  const manageLabels = canManageLabels(access.role);
  const canManage = canArchiveProject(access.role);
  const [members, labels, savedViews] = await Promise.all([
    listMembers(access.project.workspaceId),
    listLabels(access.project.workspaceId),
    listSavedViews(access.project.workspaceId, projectId),
  ]);

  const assignable = members.map((m) => ({
    id: m.userId,
    name: m.name,
    email: m.email,
    image: m.image ?? null,
  }));

  const labelOptions = labels.map((l) => ({
    id: l.id,
    name: l.name,
    color: l.color ?? null,
  }));

  return (
    <ProjectWorkspace
      board={board}
      workspaceSlug={workspaceSlug}
      editable={editable}
      canManageLabels={manageLabels}
      canManage={canManage}
      members={assignable}
      labels={labelOptions}
      viewMode="board"
      initialUrlFilters={parseUrlFilters(sp)}
      savedViews={savedViews}
    />
  );
}
