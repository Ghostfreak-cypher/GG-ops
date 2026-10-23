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

const schema = z.object({ memberId: z.string() });

export async function removeMemberAction(
  slug: string,
  input: unknown,
): Promise<ActionResult> {
  const user = await requireUser();

  const ws = await getWorkspaceForUser(slug, user.id);
  if (!ws) return { ok: false, error: "Workspace not found." };
  if (!canManageMembers(ws.role)) {
    return { ok: false, error: "You don't have permission to remove members." };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  await connectDB();
  const workspaceId = parseObjectIdOrThrow(ws.id);
  const memberId = parseObjectIdOrThrow(parsed.data.memberId);

  const target = await WorkspaceMember.findOne({ _id: memberId, workspaceId }).lean();
  if (!target) return { ok: false, error: "Member not found." };
  if (!canChangeRole(target.role)) return { ok: false, error: "Cannot remove the workspace maintainer." };
  if (String(target.userId) === user.id) return { ok: false, error: "You cannot remove yourself." };

  await WorkspaceMember.updateOne(
    { _id: memberId, workspaceId },
    { $set: { status: "REMOVED" } },
  );

  revalidatePath(`/w/${slug}/members`);
  return { ok: true };
}
