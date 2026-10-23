"use server";

import { connectDB } from "@/lib/db";
import { Section } from "@/models/Section";
import { Task } from "@/models/Task";
import { withTransaction } from "@/lib/mongo/transactions";
import { getProjectForUser } from "@/modules/project/server/access";
import { canEditTasks } from "@/modules/workspace/server/permissions";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { requireUser } from "@/modules/auth/server/session";
import type { ActionResult } from "@/lib/action-result";

export async function deleteSectionAction(sectionId: string): Promise<ActionResult> {
  const user = await requireUser();
  await connectDB();
  const section = await Section.findById(parseObjectIdOrThrow(sectionId)).lean();
  if (!section) return { ok: false, error: "Section not found." };

  const access = await getProjectForUser(String(section.projectId), user.id);
  if (!access || !canEditTasks(access.role)) {
    return { ok: false, error: "You don't have permission." };
  }

  await withTransaction(async (s) => {
    // Keep the work: move tasks out of the section, then delete the section.
    await Task.updateMany({ sectionId: section._id }, { $set: { sectionId: null } }, { session: s });
    await Section.deleteOne({ _id: section._id }, { session: s });
  });
  return { ok: true };
}
