import { connectDB } from "@/lib/db";
import { isValidObjectId, parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { Task } from "@/models/Task";
import type { DsrLinkedTaskDTO } from "@/modules/dsr/server/dto";

/** The entry fields this module cares about — write path and read path pass different shapes. */
type EntryWithTask = { taskId?: unknown };

/** Distinct, well-formed task ids across a set of entries. Order is not significant. */
export function collectTaskIds(entries: readonly EntryWithTask[]): string[] {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (entry.taskId) ids.add(String(entry.taskId));
  }
  return [...ids];
}

/**
 * Resolve DSR-linked task ids to what it takes to render them, scoped to one workspace.
 *
 * The single source of both meanings a linked task has in this feature:
 *
 * - **On write** (`upsertDsrFor`), a missing id is a *rejection* — it means the caller
 *   named a task that isn't in this workspace, which is the check that stops a report
 *   from linking (and then reading back the title of) a task the author can't see.
 * - **On read** (`toDTOs`), a missing id is *graceful degradation* — the task has since
 *   been archived or deleted, and the entry renders as plain text.
 *
 * Both need the same workspace-scoped query, so it lives here once. `projectId` comes
 * along because the task route is /w/{slug}/projects/{projectId}/tasks/{taskId} — a task
 * id alone can't build a link.
 *
 * Malformed ids are dropped rather than thrown on: the read path must never fail over
 * whatever is already stored, and on the write path a dropped id simply fails to resolve,
 * which the caller already treats as a rejection.
 */
export async function resolveLinkedTasks(
  workspaceId: string,
  taskIds: readonly string[],
): Promise<Map<string, DsrLinkedTaskDTO>> {
  const valid = taskIds.filter(isValidObjectId);
  if (valid.length === 0) return new Map();

  await connectDB();
  const tasks = await Task.find({
    _id: { $in: valid.map(parseObjectIdOrThrow) },
    workspaceId: parseObjectIdOrThrow(workspaceId),
    isArchived: false,
  })
    .select("title projectId")
    .lean();

  return new Map(
    tasks.map((task) => [
      String(task._id),
      { title: task.title, projectId: String(task.projectId) },
    ]),
  );
}
