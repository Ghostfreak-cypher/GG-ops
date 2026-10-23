"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { Project } from "@/models/Project";
import { getWorkspaceForUser } from "@/modules/workspace/server/queries";
import { canArchiveProject } from "@/modules/workspace/server/permissions";
import { getProjectForUser } from "@/modules/project/server/access";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { requireUser } from "@/modules/auth/server/session";
import type { ActionResult } from "@/lib/action-result";

export type ProjectStatusColor = "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "ON_HOLD";

const schema = z.object({
  statusColor: z.enum(["ON_TRACK", "AT_RISK", "OFF_TRACK", "ON_HOLD"]).nullable(),
  statusNote: z.string().max(280).nullable().optional(),
});

export async function updateProjectStatusAction(
  slug: string,
  projectId: string,
  input: unknown,
): Promise<ActionResult> {
  const user = await requireUser();

  const ws = await getWorkspaceForUser(slug, user.id);
  if (!ws) return { ok: false, error: "Workspace not found." };
  if (!canArchiveProject(ws.role)) {
    return { ok: false, error: "Only admins can update project status." };
  }

  const access = await getProjectForUser(projectId, user.id);
  if (!access) return { ok: false, error: "Project not found." };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  await connectDB();
  await Project.updateOne(
    { _id: parseObjectIdOrThrow(projectId), workspaceId: parseObjectIdOrThrow(ws.id) },
    {
      $set: {
        statusColor: parsed.data.statusColor,
        statusNote: parsed.data.statusNote ?? null,
        statusUpdatedAt: new Date(),
      },
    },
  );

  revalidatePath(`/w/${slug}/projects/${projectId}`);
  revalidatePath(`/w/${slug}`);
  return { ok: true };
}
