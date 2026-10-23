import { notFound } from "next/navigation";
import { requireUser } from "@/modules/auth/server/session";
import { getProjectForUser } from "@/modules/project/server/access";
import { getProjectBoard } from "@/modules/task/server/queries";
import { getProjectDependencies } from "@/modules/task/server/queries/project-dependencies";
import { canEditTasks, canArchiveProject } from "@/modules/workspace/server/permissions";
import { listMembers } from "@/modules/workspace/server/queries";
import { listLabels } from "@/modules/label/server/queries";
import { ProjectHeader } from "../project-header";
import { TimelineView } from "./timeline-view";
import type { TaskDTO } from "@/modules/task/server/dto";

export default async function TimelinePage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; projectId: string }>;
}) {
  const { workspaceSlug, projectId } = await params;
  const user = await requireUser();

  // Independent checks: getProjectBoard re-derives access itself (via the cache()d
  // getProjectForUser), rather than depending on `access`. No bar/tooltip on this page
  // renders a description, so the board fetch also skips it.
  const [access, board] = await Promise.all([
    getProjectForUser(projectId, user.id),
    getProjectBoard(projectId, user.id, {}, false),
  ]);
  if (!access) notFound();
  if (!board) notFound();

  const editable = canEditTasks(access.role);
  const canManage = canArchiveProject(access.role);

  const allTasks: TaskDTO[] = [
    ...board.sections.flatMap((s) => s.tasks),
    ...board.unsectioned,
  ];

  const [deps, members, labels] = await Promise.all([
    getProjectDependencies(access.project.workspaceId, projectId),
    listMembers(access.project.workspaceId),
    listLabels(access.project.workspaceId),
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
    <div className="mx-auto max-w-7xl space-y-4 pb-24">
      <ProjectHeader
        board={board}
        allTasks={allTasks}
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        viewMode="timeline"
        editable={editable}
        canManage={canManage}
      />
      <TimelineView
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        sections={board.sections}
        tasks={allTasks}
        dependencies={deps}
        editable={editable}
        members={assignable}
        labels={labelOptions}
      />
    </div>
  );
}
