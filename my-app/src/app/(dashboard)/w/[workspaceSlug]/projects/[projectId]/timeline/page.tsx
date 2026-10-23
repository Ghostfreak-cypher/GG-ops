import { notFound } from "next/navigation";
import { requireUser } from "@/modules/auth/server/session";
import { getProjectForUser } from "@/modules/project/server/access";
import { getProjectBoard } from "@/modules/task/server/queries";
import { getProjectDependencies } from "@/modules/task/server/queries/project-dependencies";
import { canEditTasks, canArchiveProject } from "@/modules/workspace/server/permissions";
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

  // TimelineView never used members or labels, so they are no longer fetched or sent.
  const deps = await getProjectDependencies(access.project.workspaceId, projectId);

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
      />
    </div>
  );
}
