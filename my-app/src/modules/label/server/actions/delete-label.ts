"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { Label } from "@/models/Label";
import { Task } from "@/models/Task";
import { withTransaction } from "@/lib/mongo/transactions";
import { canManageLabels } from "@/modules/workspace/server/permissions";
import { getWorkspaceForUser } from "@/modules/workspace/server/queries";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { requireUser } from "@/modules/auth/server/session";
import type { ActionResult } from "@/lib/action-result";

export async function deleteLabelAction(
  slug: string,
  labelId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const ws = await getWorkspaceForUser(slug, user.id);
  if (!ws) return { ok: false, error: "Workspace not found." };
  if (!canManageLabels(ws.role)) return { ok: false, error: "You don't have permission." };

  await connectDB();
  const workspaceId = parseObjectIdOrThrow(ws.id);
  const labelObjectId = parseObjectIdOrThrow(labelId);

  // Verify the label belongs to this workspace before touching anything.
  const label = await Label.findOne({ _id: labelObjectId, workspaceId }).select("_id").lean();
  if (!label) return { ok: false, error: "Workstream not found." };

  await withTransaction(async (session) => {
    // Unassign it from every task so no dangling label ids remain.
    await Task.updateMany(
      { workspaceId, labelIds: labelObjectId },
      { $pull: { labelIds: labelObjectId } },
      { session },
    );
    await Label.deleteOne({ _id: labelObjectId }, { session });
  });

  revalidatePath(`/w/${slug}`, "layout");
  return { ok: true };
}
