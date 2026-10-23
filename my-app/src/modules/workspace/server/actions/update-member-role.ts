"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { WorkspaceMember } from "@/models/WorkspaceMember";
import {
  canManageMembers,
  canChangeRole,
} from "@/modules/workspace/server/permissions";
import { getWorkspaceForUser } from "@/modules/workspace/server/queries";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { requireUser } from "@/modules/auth/server/session";
import { absoluteUrl } from "@/lib/urls";
import { enqueueRoleUpdatedEmail } from "@/lib/jobs/workspace-email";
import type { ActionResult } from "@/lib/action-result";

const schema = z.object({
  memberId: z.string(),
  role: z.enum(["ADMIN", "MEMBER", "GUEST"]),
});

export async function updateMemberRoleAction(
  slug: string,
  input: unknown,
): Promise<ActionResult> {
  const user = await requireUser();

  const ws = await getWorkspaceForUser(slug, user.id);
  if (!ws) return { ok: false, error: "Workspace not found." };
  if (!canManageMembers(ws.role)) {
    return { ok: false, error: "You don't have permission to manage members." };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  await connectDB();
  const workspaceId = parseObjectIdOrThrow(ws.id);
  const memberId = parseObjectIdOrThrow(parsed.data.memberId);

  const target = await WorkspaceMember.findOne({ _id: memberId, workspaceId });
  if (!target) return { ok: false, error: "Member not found." };
  if (!canChangeRole(target.role)) {
    return { ok: false, error: "You can't change the maintainer's role." };
  }

  await WorkspaceMember.updateOne(
    { _id: memberId, workspaceId },
    { $set: { role: parsed.data.role } },
  );

  await enqueueRoleUpdatedEmail(
    String(target.userId),
    ws.id,
    ws.name,
    absoluteUrl(`/w/${slug}`),
    parsed.data.role,
  );

  revalidatePath(`/w/${slug}/members`);
  return { ok: true };
}
