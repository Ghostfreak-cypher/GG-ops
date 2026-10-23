"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/server/session";
import { getWorkspaceForUser } from "@/modules/workspace/server/queries";
import { approveDraftFor, rejectDraftFor } from "@/modules/task-draft/server/review";
import type { ActionResult } from "@/lib/action-result";

/**
 * Approve a draft, with the caller's edits, as the current session user. Everything
 * identifying is derived server-side: the workspace from `slug`, the reviewer from the
 * session. The rules live in `approveDraftFor`, which is what actually creates the task.
 */
export async function approveDraftAction(
  slug: string,
  draftId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();

  const ws = await getWorkspaceForUser(slug, user.id);
  if (!ws) return { ok: false, error: "Workspace not found." };

  const result = await approveDraftFor(
    { workspaceId: ws.id, userId: user.id, userName: user.name, role: ws.role },
    draftId,
    input,
  );
  if (result.ok) revalidatePath(`/w/${slug}/drafts`);
  return result;
}

export async function rejectDraftAction(
  slug: string,
  draftId: string,
): Promise<ActionResult<undefined>> {
  const user = await requireUser();

  const ws = await getWorkspaceForUser(slug, user.id);
  if (!ws) return { ok: false, error: "Workspace not found." };

  const result = await rejectDraftFor(
    { workspaceId: ws.id, userId: user.id, userName: user.name, role: ws.role },
    draftId,
  );
  if (result.ok) revalidatePath(`/w/${slug}/drafts`);
  return result;
}
