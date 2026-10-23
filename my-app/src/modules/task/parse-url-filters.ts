import type { ViewFilters } from "./use-project-view";
import { EMPTY_FILTERS } from "./use-project-view";
import { TASK_STATUSES, TASK_PRIORITIES } from "./constants";

type SearchParamsRecord = Record<string, string | string[] | undefined>;

export function parseUrlFilters(sp: SearchParamsRecord): ViewFilters | undefined {
  const statuses = asArray(sp["s"]).filter((v): v is (typeof TASK_STATUSES)[number] =>
    (TASK_STATUSES as readonly string[]).includes(v),
  );
  const priorities = asArray(sp["p"]).filter((v): v is (typeof TASK_PRIORITIES)[number] =>
    (TASK_PRIORITIES as readonly string[]).includes(v),
  );
  const assigneeIds = asArray(sp["a"]);
  const labelIds = asArray(sp["l"]);
  const dueDateFrom = typeof sp["ddf"] === "string" ? sp["ddf"] : null;
  const dueDateTo = typeof sp["ddt"] === "string" ? sp["ddt"] : null;

  const hasAny =
    statuses.length > 0 ||
    priorities.length > 0 ||
    assigneeIds.length > 0 ||
    labelIds.length > 0 ||
    !!dueDateFrom ||
    !!dueDateTo;

  if (!hasAny) return undefined;

  return {
    ...EMPTY_FILTERS,
    statuses,
    priorities,
    assigneeIds,
    labelIds,
    dueDateFrom,
    dueDateTo,
  };
}

function asArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}
