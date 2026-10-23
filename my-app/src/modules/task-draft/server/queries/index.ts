import { connectDB } from "@/lib/db";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { TaskDraft } from "@/models/TaskDraft";
import type { TaskPriority } from "@/modules/task/constants";
import type { DraftStatus } from "@/modules/task-draft/constants";

export type DraftDTO = {
  id: string;
  projectId: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  dueDate: string | null;
  assigneeIds: string[];
  status: DraftStatus;
  confidence: number | null;
  sourceMeetingId: string | null;
  sourceMeetingTitle: string | null;
  sourceMeetingDate: string | null;
  sourceExcerpt: string | null;
  createdAt: string;
};

type DraftRow = {
  _id: unknown;
  projectId: unknown;
  title: string;
  description: string | null;
  priority: TaskPriority;
  dueDate: Date | null;
  assigneeIds: unknown[];
  status: DraftStatus;
  confidence: number | null;
  sourceMeetingId: string | null;
  sourceMeetingTitle: string | null;
  sourceMeetingDate: string | null;
  sourceExcerpt: string | null;
  createdAt: Date;
};

function toDTO(row: DraftRow): DraftDTO {
  return {
    id: String(row._id),
    projectId: row.projectId ? String(row.projectId) : null,
    title: row.title,
    description: row.description ?? null,
    priority: row.priority,
    dueDate: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : null,
    assigneeIds: row.assigneeIds.map(String),
    status: row.status,
    confidence: row.confidence ?? null,
    sourceMeetingId: row.sourceMeetingId ?? null,
    sourceMeetingTitle: row.sourceMeetingTitle ?? null,
    sourceMeetingDate: row.sourceMeetingDate ?? null,
    sourceExcerpt: row.sourceExcerpt ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export type ListDraftsOptions = {
  /** Omit to see every status — the routine's dedupe check against one meeting wants that. */
  status?: DraftStatus;
  sourceMeetingId?: string;
  limit?: number;
};

/** A workspace's drafts, newest first. The review queue (status: "PENDING") and the MCP
 *  dedupe check (sourceMeetingId, no status) are both this one query. */
export async function listDrafts(
  workspaceId: string,
  opts: ListDraftsOptions = {},
): Promise<DraftDTO[]> {
  await connectDB();
  const filter: Record<string, unknown> = { workspaceId: parseObjectIdOrThrow(workspaceId) };
  if (opts.status) filter.status = opts.status;
  if (opts.sourceMeetingId) filter.sourceMeetingId = opts.sourceMeetingId;

  const drafts = await TaskDraft.find(filter)
    .sort({ createdAt: -1 })
    .limit(opts.limit ?? 100)
    .lean();
  return (drafts as unknown as DraftRow[]).map(toDTO);
}

/** Sidebar badge count — how many drafts are waiting on a human. */
export async function countPendingDrafts(workspaceId: string): Promise<number> {
  await connectDB();
  return TaskDraft.countDocuments({
    workspaceId: parseObjectIdOrThrow(workspaceId),
    status: "PENDING",
  });
}
