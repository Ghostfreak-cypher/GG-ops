import { cache } from "react";
import { connectDB } from "@/lib/db";
import { Project } from "@/models/Project";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";

export type ProjectSummary = { id: string; name: string; color: string | null };

/** Active (non-archived) projects in a workspace. */
export const listProjects = cache(
  async (workspaceId: string): Promise<ProjectSummary[]> => {
    await connectDB();
    const projects = await Project.find({
      workspaceId: parseObjectIdOrThrow(workspaceId),
      archivedAt: null,
    })
      // Only id/name/color ever leave this function (ProjectSummary above) — this runs in
      // the dashboard layout on every navigation, so description/statusNote/key/icon are
      // dead weight fetched and discarded on every page load.
      .select("name color")
      .sort({ name: 1 })
      .lean();
    return projects.map((p) => ({
      id: String(p._id),
      name: p.name,
      color: p.color ?? null,
    }));
  },
);
