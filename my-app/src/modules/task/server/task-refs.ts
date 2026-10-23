import type { Types } from "mongoose";
import { Label } from "@/models/Label";
import { Task } from "@/models/Task";
import { WorkspaceMember } from "@/models/WorkspaceMember";

type TaskRefs = {
  assigneeIds?: Types.ObjectId[];
  labelIds?: Types.ObjectId[];
  parent?: { taskId: Types.ObjectId; projectId: Types.ObjectId };
};

/**
 * Client-sent ids a task points at must belong to the task's own workspace: assignees are
 * ACTIVE members, labels are the workspace's, and a parent is a task in the same project.
 * Returns the error to show, or null when every id checks out. MCP and task drafts already
 * enforce this; this covers the web UI and REST paths.
 */
export async function invalidTaskRef(
  workspaceId: Types.ObjectId,
  refs: TaskRefs,
): Promise<string | null> {
  const assigneeIds = [...new Set((refs.assigneeIds ?? []).map(String))];
  const labelIds = [...new Set((refs.labelIds ?? []).map(String))];
  const [members, labels, parent] = await Promise.all([
    assigneeIds.length
      ? WorkspaceMember.countDocuments({ workspaceId, userId: { $in: assigneeIds }, status: "ACTIVE" })
      : 0,
    labelIds.length ? Label.countDocuments({ workspaceId, _id: { $in: labelIds } }) : 0,
    refs.parent
      ? Task.exists({ _id: refs.parent.taskId, workspaceId, projectId: refs.parent.projectId })
      : true,
  ]);
  if (members !== assigneeIds.length) return "Assignees must be members of this workspace.";
  if (labels !== labelIds.length) return "Labels must belong to this workspace.";
  if (!parent) return "Parent task not found in this project.";
  return null;
}
