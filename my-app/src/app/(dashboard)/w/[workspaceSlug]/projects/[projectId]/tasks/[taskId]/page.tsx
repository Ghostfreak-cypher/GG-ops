import { notFound } from "next/navigation";
import { requireUser } from "@/modules/auth/server/session";
import { getProjectForUser } from "@/modules/project/server/access";
import { getTaskDetail } from "@/modules/task/server/queries";
import { listMembers } from "@/modules/workspace/server/queries";
import { listLabels } from "@/modules/label/server/queries";
import { listComments } from "@/modules/comment/server/queries";
import { getTaskActivity } from "@/modules/activity/server/queries";
import { getTaskDependencies } from "@/modules/task/server/queries/dependencies";
import { isFollowingTask, getTaskFollowers } from "@/modules/task/server/queries/follows";
import { listCustomFields, getTaskFieldValues } from "@/modules/custom-field/server/queries";
import { canEditTasks, canManageMembers } from "@/modules/workspace/server/permissions";
import { searchTasksForPickerAction } from "@/modules/task/server/actions/search-tasks-for-picker";
import { TaskDetail } from "./task-detail";
import { TaskComments } from "./task-comments";
import { TaskActivity } from "./task-activity";
import { TaskDependencies } from "./task-dependencies";
import { TaskCustomFields } from "./task-custom-fields";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; projectId: string; taskId: string }>;
}) {
  const { workspaceSlug, projectId, taskId } = await params;
  const user = await requireUser();

  // Independent checks: getTaskDetail re-derives access itself from the task's own
  // projectId (via the cache()d getProjectForUser), rather than depending on `access`.
  const [access, task] = await Promise.all([
    getProjectForUser(projectId, user.id),
    getTaskDetail(taskId, user.id),
  ]);
  if (!access) notFound();
  if (!task) notFound();

  const editable = canEditTasks(access.role);
  const [members, labels, comments, activity, dependencies, customFields, fieldValues, following, followers] = await Promise.all([
    listMembers(access.project.workspaceId),
    listLabels(access.project.workspaceId),
    listComments(taskId, user.id),
    getTaskActivity(taskId),
    getTaskDependencies(access.project.workspaceId, taskId),
    listCustomFields(access.project.workspaceId, projectId),
    getTaskFieldValues(access.project.workspaceId, taskId),
    isFollowingTask(access.project.workspaceId, taskId, user.id),
    getTaskFollowers(access.project.workspaceId, taskId),
  ]);

  return (
    <TaskDetail
      slug={workspaceSlug}
      projectId={projectId}
      task={task}
      editable={editable}
      members={members.map((m) => ({ id: m.userId, name: m.name, email: m.email, image: m.image }))}
      labels={labels}
      backHref={`/w/${workspaceSlug}/projects/${projectId}`}
      isFollowing={following}
      followerCount={followers.length}
      activity={<TaskActivity activity={activity} />}
    >
      <div className="space-y-8 border-t border-border pt-6">
        {customFields.length > 0 && (
          <TaskCustomFields
            workspaceSlug={workspaceSlug}
            taskId={taskId}
            fields={customFields}
            values={fieldValues}
            editable={editable}
          />
        )}

        <TaskDependencies
          slug={workspaceSlug}
          taskId={taskId}
          workspaceId={access.project.workspaceId}
          projectId={projectId}
          dependencies={dependencies}
          searchableTasksAction={searchTasksForPickerAction}
          editable={editable}
        />

        <TaskComments
          taskId={taskId}
          comments={comments}
          editable={editable}
          currentUserId={user.id}
          canModerate={canManageMembers(access.role)}
          workspaceSlug={workspaceSlug}
          members={members.map((m) => ({ id: m.userId, name: m.name, email: m.email, image: m.image }))}
        />
      </div>
    </TaskDetail>
  );
}
