"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { Goal } from "@/models/Goal";
import { createGoalSchema } from "@/modules/goal/schemas";
import { getWorkspaceForUser } from "@/modules/workspace/server/queries";
import { parseObjectIdOrThrow, isValidObjectId } from "@/lib/mongo/ids";
import { requireUser } from "@/modules/auth/server/session";
import type { ActionResult } from "@/lib/action-result";

export async function createGoalAction(
  slug: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const ws = await getWorkspaceForUser(slug, user.id);
  if (!ws) return { ok: false, error: "Workspace not found." };

  const parsed = createGoalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await connectDB();
  const { parentGoalId, dueDate, ...rest } = parsed.data;

  const goal = await Goal.create({
    ...rest,
    workspaceId: parseObjectIdOrThrow(ws.id),
    parentGoalId: parentGoalId && isValidObjectId(parentGoalId)
      ? parseObjectIdOrThrow(parentGoalId)
      : null,
    dueDate: dueDate ? new Date(dueDate) : null,
    ownerId: parseObjectIdOrThrow(user.id),
  });

  revalidatePath(`/w/${slug}/strategy/goals`);
  return { ok: true, data: { id: String(goal._id) } };
}
