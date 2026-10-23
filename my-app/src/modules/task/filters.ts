export type TaskFilters = {
  status?: string;
  priority?: string;
  assigneeId?: string;
  labelId?: string;
};

/** Merge active filters onto a base Mongo query (empty/undefined values are ignored). */
export function buildTaskFilter(
  base: Record<string, unknown>,
  f: TaskFilters,
): Record<string, unknown> {
  const q: Record<string, unknown> = { ...base };
  if (f.status) q.status = f.status;
  if (f.priority) q.priority = f.priority;
  if (f.assigneeId) q.assigneeIds = f.assigneeId;
  if (f.labelId) q.labelIds = f.labelId;
  return q;
}
