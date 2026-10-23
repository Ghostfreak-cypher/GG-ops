import { connectDB } from "@/lib/db";
import { isValidObjectId, parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { TaskDraft } from "@/models/TaskDraft";
import { Project } from "@/models/Project";
import { WorkspaceMember } from "@/models/WorkspaceMember";
import { canEditTasks } from "@/modules/workspace/server/permissions";
import { createDraftSchema } from "@/modules/task-draft/schemas";
import { stripMentions } from "@/modules/task/server/strip-mentions";
import type { WorkspaceRole } from "@/modules/workspace/roles";
import type { ActionResult } from "@/lib/action-result";

/**
 * Who is creating the draft — always the `create_task_draft` MCP tool, on behalf of the
 * bot account authenticated by the caller's PAT. There is no web path that creates a draft,
 * only ones that review an existing one (see server/review.ts).
 */
export type DraftAuthor = {
  workspaceId: string;
  userId: string;
  userName: string;
  role: WorkspaceRole;
};

/**
 * Create a task draft — never a real task. This is the only write surface the meeting-drafts
 * routine has: a fully successful prompt injection in a meeting note buys an attacker-chosen
 * draft that a human must still approve, not a task.
 */
export async function createDraftFor(
  ctx: DraftAuthor,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  if (!canEditTasks(ctx.role)) {
    return { ok: false, error: "You don't have permission to create tasks in this workspace." };
  }

  const parsed = createDraftSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  await connectDB();

  // Re-verify scope rather than trust it — the same discipline resolveLinkedTasks applies
  // to DSR-linked tasks, here for the project a draft names.
  let projectId: ReturnType<typeof parseObjectIdOrThrow> | null = null;
  if (d.projectId) {
    projectId = parseObjectIdOrThrow(d.projectId);
    const exists = await Project.exists({
      _id: projectId,
      workspaceId: ctx.workspaceId,
      archivedAt: null,
    });
    if (!exists) return { ok: false, error: "That project isn't in this workspace." };
  }

  const rawAssigneeIds = d.assigneeIds ?? [];
  const assigneeIds = rawAssigneeIds.filter(isValidObjectId);
  if (assigneeIds.length !== rawAssigneeIds.length) {
    return { ok: false, error: "One of the assignee ids is malformed." };
  }
  if (assigneeIds.length > 0) {
    const activeCount = await WorkspaceMember.countDocuments({
      workspaceId: ctx.workspaceId,
      userId: { $in: assigneeIds },
      status: "ACTIVE",
    });
    if (activeCount !== assigneeIds.length) {
      return { ok: false, error: "One of the assignees isn't an active member of this workspace." };
    }
  }

  const draft = await TaskDraft.create({
    workspaceId: parseObjectIdOrThrow(ctx.workspaceId),
    projectId,
    title: d.title,
    // Stripped here, once, from AI-authored text. A human editing the description at
    // approval time is writing new content and is free to @mention someone.
    description: d.description ? stripMentions(d.description) : null,
    priority: d.priority ?? "MEDIUM",
    dueDate: d.dueDate ?? null,
    assigneeIds: assigneeIds.map((id) => parseObjectIdOrThrow(id)),
    confidence: d.confidence ?? null,
    sourceMeetingId: d.sourceMeetingId ?? null,
    sourceMeetingTitle: d.sourceMeetingTitle ?? null,
    sourceMeetingDate: d.sourceMeetingDate ?? null,
    sourceExcerpt: d.sourceExcerpt ?? null,
    createdBy: parseObjectIdOrThrow(ctx.userId),
  });

  return { ok: true, data: { id: String(draft._id) } };
}
