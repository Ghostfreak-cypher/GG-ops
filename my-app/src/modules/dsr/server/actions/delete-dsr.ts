"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { isValidObjectId, parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { DailyStatusReport } from "@/models/DailyStatusReport";
import { requireUser } from "@/modules/auth/server/session";
import { getWorkspaceForUser } from "@/modules/workspace/server/queries";
import { canSubmitDsr } from "@/modules/workspace/server/permissions";
import { logActivity } from "@/modules/activity/log";
import { deleteDsrSchema } from "@/modules/dsr/schemas";
import type { ActionResult } from "@/lib/action-result";

/** Withdraw one of the caller's own reports. Nobody can delete anyone else's. */
export async function deleteDsrAction(slug: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();

  const ws = await getWorkspaceForUser(slug, user.id);
  if (!ws) return { ok: false, error: "Workspace not found." };
  if (!canSubmitDsr(ws.role)) {
    return { ok: false, error: "Guests can't file daily status reports." };
  }

  const parsed = deleteDsrSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  if (!isValidObjectId(parsed.data.dsrId)) return { ok: false, error: "Report not found." };

  await connectDB();

  // Scoped by workspace and author, so the filter itself can only ever match the caller's
  // own row — there's no window between an ownership check and the delete.
  const result = await DailyStatusReport.deleteOne({
    _id: parseObjectIdOrThrow(parsed.data.dsrId),
    workspaceId: parseObjectIdOrThrow(ws.id),
    userId: parseObjectIdOrThrow(user.id),
  });

  // Same message whether the report never existed or belongs to someone else — a distinct
  // "not yours" would confirm that a given id is real.
  if (result.deletedCount === 0) return { ok: false, error: "Report not found." };

  await logActivity({
    workspaceId: ws.id,
    actorId: user.id,
    action: "DSR_DELETED",
    metadata: { dsrId: parsed.data.dsrId },
  });

  revalidatePath(`/w/${slug}/dsr`);

  return { ok: true };
}
