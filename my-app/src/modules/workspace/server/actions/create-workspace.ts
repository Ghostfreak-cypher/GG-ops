"use server";

import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { withTransaction } from "@/lib/mongo/transactions";
import { Workspace } from "@/models/Workspace";
import { WorkspaceMember } from "@/models/WorkspaceMember";
import { Label } from "@/models/Label";
import { createWorkspaceSchema } from "@/modules/workspace/schemas";
import { DEFAULT_WORKSTREAMS } from "@/lib/label-colors";
import { slugify } from "@/lib/slug";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { requireUser } from "@/modules/auth/server/session";
import type { ActionResult } from "@/lib/action-result";

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || "workspace";
  let slug = base;
  let n = 1;
  while (await Workspace.exists({ slug })) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

export async function createWorkspaceAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = createWorkspaceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await connectDB();
  const ownerId = parseObjectIdOrThrow(user.id);
  const slug = await uniqueSlug(parsed.data.name);

  await withTransaction(async (session) => {
    const [workspace] = await Workspace.create(
      [{ name: parsed.data.name, slug, ownerId }],
      { session },
    );
    await WorkspaceMember.create(
      [
        {
          workspaceId: workspace._id,
          userId: ownerId,
          role: "MAINTAINER",
          status: "ACTIVE",
          joinedAt: new Date(),
        },
      ],
      { session },
    );
    // Seed the default workstreams so a new workspace starts with a taxonomy.
    await Label.create(
      DEFAULT_WORKSTREAMS.map((w) => ({
        workspaceId: workspace._id,
        name: w.name,
        color: w.color,
        createdBy: ownerId,
      })),
      { session, ordered: true },
    );
  });

  redirect(`/w/${slug}`);
}
