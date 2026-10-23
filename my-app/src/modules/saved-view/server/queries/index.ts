import { connectDB } from "@/lib/db";
import { SavedView } from "@/models/SavedView";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";

export type SavedViewDTO = {
  id: string;
  name: string;
  filters: {
    statuses: string[];
    priorities: string[];
    assigneeIds: string[];
    labelIds: string[];
    dueDateFrom: string | null;
    dueDateTo: string | null;
  };
  sortBy: string;
  sortDir: "asc" | "desc";
  groupBy: string;
  showCompleted: boolean;
  createdBy: string;
};

export async function listSavedViews(
  workspaceId: string,
  projectId: string,
): Promise<SavedViewDTO[]> {
  await connectDB();
  const wsId = parseObjectIdOrThrow(workspaceId);
  const pid = parseObjectIdOrThrow(projectId);

  const views = await SavedView.find({ workspaceId: wsId, projectId: pid })
    .sort({ createdAt: 1 })
    .lean();

  return views.map((v) => ({
    id: String(v._id),
    name: v.name,
    filters: {
      statuses: v.filters.statuses,
      priorities: v.filters.priorities,
      assigneeIds: v.filters.assigneeIds,
      labelIds: v.filters.labelIds,
      dueDateFrom: v.filters.dueDateFrom ?? null,
      dueDateTo: v.filters.dueDateTo ?? null,
    },
    sortBy: v.sortBy,
    sortDir: v.sortDir,
    groupBy: v.groupBy,
    showCompleted: v.showCompleted,
    createdBy: String(v.createdBy),
  }));
}
