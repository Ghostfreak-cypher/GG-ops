"use server";

import { redirect } from "next/navigation";
import { getWorkspaceForUser } from "@/modules/workspace/server/queries";
import { requireUser } from "@/modules/auth/server/session";
import { createProjectFor } from "@/modules/project/server/create-project-core";
import type { ActionResult } from "@/lib/action-result";

export async function createProjectAction(slug: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const ws = await getWorkspaceForUser(slug, user.id);
  if (!ws) return { ok: false, error: "Workspace not found." };

  const result = await createProjectFor(ws, user.id, input);
  if (!result.ok) return result;

  redirect(`/w/${slug}/projects/${result.data!.id}`);
}
