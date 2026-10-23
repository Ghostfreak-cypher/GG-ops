import { notFound } from "next/navigation";
import { requireUser } from "@/modules/auth/server/session";
import { getProjectForUser } from "@/modules/project/server/access";
import { getProjectBoard } from "@/modules/task/server/queries";
import { listCustomFields } from "@/modules/custom-field/server/queries";
import { canArchiveProject, canEditTasks } from "@/modules/workspace/server/permissions";
import { ProjectHeader } from "../project-header";
import { CustomFieldsSettings } from "./custom-fields-settings";
import type { TaskDTO } from "@/modules/task/server/dto";

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; projectId: string }>;
}) {
  const { workspaceSlug, projectId } = await params;
  const user = await requireUser();

  const access = await getProjectForUser(projectId, user.id);
  if (!access) notFound();

  const canManage = canArchiveProject(access.role);
  if (!canManage) notFound();

  // Only stats (progress bar, status counts) are rendered here — no task description.
  const [board, fields] = await Promise.all([
    getProjectBoard(projectId, user.id, {}, false),
    listCustomFields(access.project.workspaceId, projectId),
  ]);
  if (!board) notFound();

  const allTasks: TaskDTO[] = [
    ...board.sections.flatMap((s) => s.tasks),
    ...board.unsectioned,
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-24">
      <ProjectHeader
        board={board}
        allTasks={allTasks}
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        viewMode="settings"
        editable={canEditTasks(access.role)}
        canManage={canManage}
      />

      <CustomFieldsSettings
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        fields={fields}
      />
    </div>
  );
}
