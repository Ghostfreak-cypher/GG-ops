"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { Label } from "@/models/Label";
import { createLabelSchema } from "@/modules/label/schemas";
import { canManageLabels } from "@/modules/workspace/server/permissions";
import { getWorkspaceForUser } from "@/modules/workspace/server/queries";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { requireUser } from "@/modules/auth/server/session";
import type { ActionResult } from "@/lib/action-result";

export async function createLabelAction(
  slug: string,
  input: unknown,
): Promise<ActionResult<{ id: string; name: string; color: string | null }>> {
  const user = await requireUser();
  const ws = await getWorkspaceForUser(slug, user.id);
  if (!ws) return { ok: false, error: "Workspace not found." };
  if (!canManageLabels(ws.role)) return { ok: false, error: "You don't have permission." };

  const parsed = createLabelSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await connectDB();
  const label = await Label.create({
    workspaceId: parseObjectIdOrThrow(ws.id),
    name: parsed.data.name,
    color: parsed.data.color ?? null,
    createdBy: parseObjectIdOrThrow(user.id),
  });

  revalidatePath(`/w/${slug}`, "layout");
  return {
    ok: true,
    data: { id: String(label._id), name: label.name, color: label.color ?? null },
  };
}
