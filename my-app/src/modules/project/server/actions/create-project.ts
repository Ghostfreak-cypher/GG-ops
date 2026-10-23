"use server";

import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Project } from "@/models/Project";
import { createProjectSchema } from "@/modules/project/schemas";
import { canCreateProject } from "@/modules/workspace/server/permissions";
import { getWorkspaceForUser } from "@/modules/workspace/server/queries";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { requireUser } from "@/modules/auth/server/session";
import { logActivity } from "@/modules/activity/log";
import type { ActionResult } from "@/lib/action-result";

export async function createProjectAction(slug: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const ws = await getWorkspaceForUser(slug, user.id);
  if (!ws) return { ok: false, error: "Workspace not found." };
  if (!canCreateProject(ws.role)) {
    return { ok: false, error: "You don't have permission to create projects." };
  }

  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await connectDB();
  const project = await Project.create({
    workspaceId: parseObjectIdOrThrow(ws.id),
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    color: parsed.data.color ?? null,
    createdBy: parseObjectIdOrThrow(user.id),
  });

  await logActivity({
    workspaceId: ws.id,
    projectId: String(project._id),
    actorId: user.id,
    action: "PROJECT_CREATED",
  });

  redirect(`/w/${slug}/projects/${project._id}`);
}
