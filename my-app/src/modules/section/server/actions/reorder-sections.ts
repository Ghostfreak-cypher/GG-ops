"use server";

import { connectDB } from "@/lib/db";
import { Section } from "@/models/Section";
import { withTransaction } from "@/lib/mongo/transactions";
import { reorderSectionsSchema } from "@/modules/section/schemas";
import { getProjectForUser } from "@/modules/project/server/access";
import { canEditTasks } from "@/modules/workspace/server/permissions";
import { POSITION_STEP } from "@/modules/task/position";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { requireUser } from "@/modules/auth/server/session";
import type { ActionResult } from "@/lib/action-result";

export async function reorderSectionsAction(
  projectId: string,
  input: unknown,
): Promise<ActionResult> {
  const user = await requireUser();
  const access = await getProjectForUser(projectId, user.id);
  if (!access || !canEditTasks(access.role)) {
    return { ok: false, error: "You don't have permission." };
  }

  const parsed = reorderSectionsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  await connectDB();
  const pid = parseObjectIdOrThrow(projectId);
  const ids = parsed.data.orderedIds.map((id) => parseObjectIdOrThrow(id));

  // Every section must belong to this project.
  const count = await Section.countDocuments({ _id: { $in: ids }, projectId: pid });
  if (count !== ids.length) {
    return { ok: false, error: "Some sections don't belong to this project." };
  }

  await withTransaction(async (s) => {
    for (let i = 0; i < ids.length; i++) {
      await Section.updateOne(
        { _id: ids[i], projectId: pid },
        { $set: { position: (i + 1) * POSITION_STEP } },
        { session: s },
      );
    }
  });
  return { ok: true };
}
