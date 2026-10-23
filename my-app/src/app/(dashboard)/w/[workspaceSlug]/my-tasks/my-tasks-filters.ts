import type { TaskStatus, TaskPriority } from "@/modules/task/constants";
import type { MyTaskDTO } from "@/modules/dashboard/server/queries";

export type MyTaskFilters = {
  search: string;
  statuses: TaskStatus[];
  priorities: TaskPriority[];
  projectIds: string[];
  labelIds: string[];
};

export const EMPTY_MY_TASK_FILTERS: MyTaskFilters = {
  search: "",
  statuses: [],
  priorities: [],
  projectIds: [],
  labelIds: [],
};

export type FilterOption = { id: string; name: string; color?: string | null };

/** Pure, in-memory filter over the user's tasks. Empty arrays = no constraint;
 *  multiple dimensions AND together, values within a dimension OR. */
export function applyMyTaskFilters(tasks: MyTaskDTO[], filters: MyTaskFilters): MyTaskDTO[] {
  const q = filters.search.trim().toLowerCase();
  return tasks.filter((t) => {
    if (q && !t.title.toLowerCase().includes(q)) return false;
    if (filters.statuses.length && !filters.statuses.includes(t.status)) return false;
    if (filters.priorities.length && !filters.priorities.includes(t.priority)) return false;
    if (filters.projectIds.length && !filters.projectIds.includes(t.projectId)) return false;
    if (filters.labelIds.length && !filters.labelIds.some((id) => t.labelIds.includes(id)))
      return false;
    return true;
  });
}
