"use server";

import { connectDB } from "@/lib/db";
import { Project } from "@/models/Project";
import { getProjectForUser } from "@/modules/project/server/access";
import { canArchiveProject } from "@/modules/workspace/server/permissions";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { requireUser } from "@/modules/auth/server/session";
import type { ActionResult } from "@/lib/action-result";

export async function archiveProjectAction(projectId: string): Promise<ActionResult> {
  const user = await requireUser();
  const access = await getProjectForUser(projectId, user.id);
  if (!access) return { ok: false, error: "Project not found." };
  if (!canArchiveProject(access.role)) {
    return { ok: false, error: "You don't have permission to archive this project." };
  }

  await connectDB();
  await Project.updateOne(
    { _id: parseObjectIdOrThrow(projectId) },
    { $set: { archivedAt: new Date() } },
  );
  return { ok: true };
}
