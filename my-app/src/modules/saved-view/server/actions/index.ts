"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/server/session";
import { getProjectForUser } from "@/modules/project/server/access";
import { SavedView } from "@/models/SavedView";
import { connectDB } from "@/lib/db";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { canEditTasks } from "@/modules/workspace/server/permissions";
import { ActionResult } from "@/lib/action-result";

const SavedViewInput = z.object({
  name: z.string().min(1).max(80).trim(),
  filters: z.object({
    statuses: z.array(z.string()).default([]),
    priorities: z.array(z.string()).default([]),
    assigneeIds: z.array(z.string()).default([]),
    labelIds: z.array(z.string()).default([]),
    dueDateFrom: z.string().nullable().default(null),
    dueDateTo: z.string().nullable().default(null),
  }),
  sortBy: z.string().default("title"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
  groupBy: z.string().default("section"),
  showCompleted: z.boolean().default(true),
});

export async function createSavedViewAction(
  workspaceSlug: string,
  projectId: string,
  input: z.infer<typeof SavedViewInput>,
): Promise<ActionResult<{ id: string; name: string }>> {
  const user = await requireUser();
  const access = await getProjectForUser(projectId, user.id);
  if (!access || !canEditTasks(access.role)) {
    return { ok: false, error: "Not authorized" };
  }

  const parsed = SavedViewInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await connectDB();
  const wsId = parseObjectIdOrThrow(access.project.workspaceId);
  const pid = parseObjectIdOrThrow(projectId);

  const view = await SavedView.create({
    workspaceId: wsId,
    projectId: pid,
    createdBy: parseObjectIdOrThrow(user.id),
    name: parsed.data.name,
    filters: parsed.data.filters,
    sortBy: parsed.data.sortBy,
    sortDir: parsed.data.sortDir,
    groupBy: parsed.data.groupBy,
    showCompleted: parsed.data.showCompleted,
  });

  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}`);
  return { ok: true, data: { id: String(view._id), name: view.name } };
}

export async function deleteSavedViewAction(
  workspaceSlug: string,
  projectId: string,
  viewId: string,
): Promise<ActionResult<null>> {
  const user = await requireUser();
  const access = await getProjectForUser(projectId, user.id);
  if (!access) return { ok: false, error: "Not found" };

  await connectDB();
  const wsId = parseObjectIdOrThrow(access.project.workspaceId);
  const vid = parseObjectIdOrThrow(viewId);

  const view = await SavedView.findOne({ _id: vid, workspaceId: wsId, projectId: parseObjectIdOrThrow(projectId) });
  if (!view) return { ok: false, error: "Not found" };

  // Only owner or admin can delete
  const isOwner = String(view.createdBy) === user.id;
  const canAdmin = access.role === "MAINTAINER" || access.role === "ADMIN";
  if (!isOwner && !canAdmin) return { ok: false, error: "Not authorized" };

  await SavedView.deleteOne({ _id: vid });
  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}`);
  return { ok: true, data: null };
}
