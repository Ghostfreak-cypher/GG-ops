"use server";

import { connectDB } from "@/lib/db";
import { Section } from "@/models/Section";
import { createSectionSchema } from "@/modules/section/schemas";
import { getProjectForUser } from "@/modules/project/server/access";
import { canEditTasks } from "@/modules/workspace/server/permissions";
import { nextPosition } from "@/modules/task/position";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { requireUser } from "@/modules/auth/server/session";
import type { ActionResult } from "@/lib/action-result";

export async function createSectionAction(
  projectId: string,
  input: unknown,
): Promise<ActionResult> {
  const user = await requireUser();
  const access = await getProjectForUser(projectId, user.id);
  if (!access) return { ok: false, error: "Project not found." };
  if (!canEditTasks(access.role)) return { ok: false, error: "You don't have permission." };

  const parsed = createSectionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await connectDB();
  const pid = parseObjectIdOrThrow(projectId);
  const existing = await Section.find({ projectId: pid }).select("position").lean();
  await Section.create({
    workspaceId: parseObjectIdOrThrow(access.project.workspaceId),
    projectId: pid,
    name: parsed.data.name,
    position: nextPosition(existing.map((s) => s.position ?? 0)),
  });
  return { ok: true };
}
