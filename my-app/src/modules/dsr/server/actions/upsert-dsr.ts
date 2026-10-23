"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/server/session";
import { getWorkspaceForUser } from "@/modules/workspace/server/queries";
import { upsertDsrFor } from "@/modules/dsr/server/upsert";
import type { DsrDTO } from "@/modules/dsr/server/dto";
import type { ActionResult } from "@/lib/action-result";

/**
 * File or amend the caller's own report for one day. Re-filing an existing date edits it,
 * so the form needs no separate create/update paths.
 *
 * Everything identifying is derived server-side: the workspace from `slug`, the author from
 * the session. `input` only ever supplies the report's content and which day it's about. The
 * rules themselves live in `upsertDsrFor`, shared with the MCP connector route.
 */
export async function upsertDsrAction(
  slug: string,
  input: unknown,
): Promise<ActionResult<DsrDTO>> {
  const user = await requireUser();

  const ws = await getWorkspaceForUser(slug, user.id);
  if (!ws) return { ok: false, error: "Workspace not found." };

  const result = await upsertDsrFor(
    { workspaceId: ws.id, userId: user.id, userName: user.name, role: ws.role },
    input,
  );
  if (!result.ok) return result;

  revalidatePath(`/w/${slug}/dsr`);
  return result;
}
