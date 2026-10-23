import { connectDB } from "@/lib/db";
import { isValidObjectId, parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { TaskDraft } from "@/models/TaskDraft";
import { canEditTasks } from "@/modules/workspace/server/permissions";
import { createTaskForActor } from "@/modules/task/server/create-task-core";
import { approveDraftSchema } from "@/modules/task-draft/schemas";
import type { WorkspaceRole } from "@/modules/workspace/roles";
import type { ActionResult } from "@/lib/action-result";

/**
 * The human reviewing a draft. Both actions below run as this person — the activity log,
 * Pusher event, and assignee notifications that `createTaskForActor` fires all name the
 * reviewer, never the bot that authored the draft.
 */
export type DraftReviewer = {
  workspaceId: string;
  userId: string;
  userName: string;
  role: WorkspaceRole;
};

/**
 * Approve a pending draft: create the real task as the reviewer, then mark the draft
 * APPROVED. The status flip is an atomic `findOneAndUpdate` gated on `status: "PENDING"`,
 * so a double-click — or two reviewers racing — can approve a given draft at most once.
 */
export async function approveDraftFor(
  ctx: DraftReviewer,
  draftId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  if (!canEditTasks(ctx.role)) {
    return { ok: false, error: "You don't have permission to approve drafts." };
  }
  if (!isValidObjectId(draftId)) return { ok: false, error: "Draft not found." };

  const parsed = approveDraftSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  await connectDB();

  const claimed = await TaskDraft.findOneAndUpdate(
    {
      _id: parseObjectIdOrThrow(draftId),
      workspaceId: parseObjectIdOrThrow(ctx.workspaceId),
      status: "PENDING",
    },
    { $set: { status: "APPROVED", reviewedBy: ctx.userId, reviewedAt: new Date() } },
  );
  if (!claimed) return { ok: false, error: "Draft not found, or already reviewed." };

  const result = await createTaskForActor({ id: ctx.userId, name: ctx.userName }, d.projectId, {
    title: d.title,
    description: d.description,
    priority: d.priority,
    dueDate: d.dueDate,
    assigneeIds: d.assigneeIds ?? [],
  });

  if (!result.ok) {
    // The draft claimed APPROVED but no task exists behind it — put it back so the reviewer
    // can fix the problem (e.g. pick a different project) and retry, instead of it being
    // stuck in a state nothing can act on.
    await TaskDraft.updateOne(
      { _id: draftId },
      { $set: { status: "PENDING" }, $unset: { reviewedBy: "", reviewedAt: "" } },
    );
    return result;
  }

  await TaskDraft.updateOne({ _id: draftId }, { $set: { createdTaskId: result.data!.id } });
  return { ok: true, data: { id: result.data!.id } };
}

/** Reject a pending draft. Same atomic gate as approve — reviewable exactly once. */
export async function rejectDraftFor(
  ctx: DraftReviewer,
  draftId: string,
): Promise<ActionResult<undefined>> {
  if (!canEditTasks(ctx.role)) {
    return { ok: false, error: "You don't have permission to reject drafts." };
  }
  if (!isValidObjectId(draftId)) return { ok: false, error: "Draft not found." };

  await connectDB();
  const claimed = await TaskDraft.findOneAndUpdate(
    {
      _id: parseObjectIdOrThrow(draftId),
      workspaceId: parseObjectIdOrThrow(ctx.workspaceId),
      status: "PENDING",
    },
    { $set: { status: "REJECTED", reviewedBy: ctx.userId, reviewedAt: new Date() } },
  );
  if (!claimed) return { ok: false, error: "Draft not found, or already reviewed." };
  return { ok: true };
}
