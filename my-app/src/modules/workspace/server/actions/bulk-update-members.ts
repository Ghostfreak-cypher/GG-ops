"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { WorkspaceMember } from "@/models/WorkspaceMember";
import { canManageMembers, canChangeRole } from "@/modules/workspace/server/permissions";
import { getWorkspaceForUser } from "@/modules/workspace/server/queries";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { requireUser } from "@/modules/auth/server/session";
import type { ActionResult } from "@/lib/action-result";

const schema = z.union([
  z.object({
    memberIds: z.array(z.string()).min(1),
    action: z.literal("role"),
    role: z.enum(["ADMIN", "MEMBER", "GUEST"]),
  }),
  z.object({
    memberIds: z.array(z.string()).min(1),
    action: z.literal("remove"),
  }),
]);

export async function bulkUpdateMembersAction(
  slug: string,
  input: unknown,
): Promise<ActionResult<{ updated: number }>> {
  const user = await requireUser();

  const ws = await getWorkspaceForUser(slug, user.id);
  if (!ws) return { ok: false, error: "Workspace not found." };
  if (!canManageMembers(ws.role)) {
    return { ok: false, error: "Insufficient permissions." };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  await connectDB();
  const workspaceId = parseObjectIdOrThrow(ws.id);
  const memberObjectIds = parsed.data.memberIds.map(parseObjectIdOrThrow);

  // Fetch targets to verify ownership chain (no MAINTAINER changes, no self-remove)
  const targets = await WorkspaceMember.find({
    _id: { $in: memberObjectIds },
    workspaceId,
    status: { $ne: "REMOVED" },
  }).lean();

  // Filter out MAINTAINERs and self-remove
  const safeIds = targets
    .filter(
      (m) =>
        canChangeRole(m.role) &&
        !(parsed.data.action === "remove" && String(m.userId) === user.id),
    )
    .map((m) => m._id);

  if (safeIds.length === 0) {
    return { ok: false, error: "No eligible members to update." };
  }

  if (parsed.data.action === "role") {
    await WorkspaceMember.updateMany(
      { _id: { $in: safeIds }, workspaceId },
      { $set: { role: parsed.data.role } },
    );
  } else {
    await WorkspaceMember.updateMany(
      { _id: { $in: safeIds }, workspaceId },
      { $set: { status: "REMOVED" } },
    );
  }

  revalidatePath(`/w/${slug}/members`);
  return { ok: true, data: { updated: safeIds.length } };
}
