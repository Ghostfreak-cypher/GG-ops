/**
 * Project creation, shared by the Server Action and the MCP `create_project` tool.
 *
 * ⚠️ THIS FILE MUST NOT CARRY THE `"use server"` DIRECTIVE. ⚠️ It takes the actor as a
 * parameter, so as a Server Action module it would be a public impersonation endpoint (see
 * create-task-core.ts). `ws` must come from `getWorkspaceForUser` / `resolveWorkspace`, which
 * only return workspaces the actor is an ACTIVE member of; the role check still runs here.
 */

import { connectDB } from "@/lib/db";
import { Project } from "@/models/Project";
import { createProjectSchema } from "@/modules/project/schemas";
import { canCreateProject } from "@/modules/workspace/server/permissions";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { logActivity } from "@/modules/activity/log";
import type { WorkspaceSummary } from "@/modules/workspace/server/dto";
import type { ActionResult } from "@/lib/action-result";

export async function createProjectFor(
  ws: WorkspaceSummary,
  actorId: string,
  input: unknown,
): Promise<ActionResult<{ id: string; name: string }>> {
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
    createdBy: parseObjectIdOrThrow(actorId),
  });

  await logActivity({
    workspaceId: ws.id,
    projectId: String(project._id),
    actorId,
    action: "PROJECT_CREATED",
  });

  return { ok: true, data: { id: String(project._id), name: project.name } };
}
