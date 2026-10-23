import { cache } from "react";
import { connectDB } from "@/lib/db";
import { Project } from "@/models/Project";
import { Section } from "@/models/Section";
import { WorkspaceMember } from "@/models/WorkspaceMember";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import type { WorkspaceRole } from "@/modules/workspace/roles";

export type ProjectAccess = {
  project: { id: string; workspaceId: string; name: string };
  role: WorkspaceRole;
};

/**
 * Resolve a project AND verify the caller is an active member of its workspace.
 * The Phase-2 ownership chain: user ∈ workspace, project ∈ workspace. Returns null if
 * the project doesn't exist (or is archived) or the user isn't a member.
 */
export const getProjectForUser = cache(async (
  projectId: string,
  userId: string,
): Promise<ProjectAccess | null> => {
  await connectDB();
  const project = await Project.findOne({
    _id: parseObjectIdOrThrow(projectId),
    archivedAt: null,
  })
    // Only these three fields ever leave this function (see ProjectAccess above) — this
    // runs on every board load and every task mutation, so skipping description/statusNote/
    // key/icon/color is a straightforward win.
    .select("workspaceId name")
    .lean();
  if (!project) return null;

  const membership = await WorkspaceMember.findOne({
    workspaceId: project.workspaceId,
    userId: parseObjectIdOrThrow(userId),
    status: "ACTIVE",
  })
    .select("role")
    .lean();
  if (!membership) return null;

  return {
    project: {
      id: String(project._id),
      workspaceId: String(project.workspaceId),
      name: project.name,
    },
    role: membership.role as WorkspaceRole,
  };
});

/** Verify a section belongs to the given project (section ∈ project chain). */
export async function assertSectionInProject(
  sectionId: string,
  projectId: string,
): Promise<boolean> {
  await connectDB();
  const section = await Section.findOne({
    _id: parseObjectIdOrThrow(sectionId),
    projectId: parseObjectIdOrThrow(projectId),
  })
    .select("_id")
    .lean();
  return !!section;
}
