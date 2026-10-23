"use server";

import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Section } from "@/models/Section";
import { getProjectForUser } from "@/modules/project/server/access";
import { canEditTasks } from "@/modules/workspace/server/permissions";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { requireUser } from "@/modules/auth/server/session";
import type { ActionResult } from "@/lib/action-result";

const schema = z.object({ name: z.string().trim().min(1).max(80) });

export async function renameSectionAction(
  sectionId: string,
  input: unknown,
): Promise<ActionResult> {
  const user = await requireUser();
  await connectDB();
  const section = await Section.findById(parseObjectIdOrThrow(sectionId)).lean();
  if (!section) return { ok: false, error: "Section not found." };

  const access = await getProjectForUser(String(section.projectId), user.id);
  if (!access || !canEditTasks(access.role)) {
    return { ok: false, error: "You don't have permission." };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid name" };

  await Section.updateOne({ _id: section._id }, { $set: { name: parsed.data.name } });
  return { ok: true };
}
