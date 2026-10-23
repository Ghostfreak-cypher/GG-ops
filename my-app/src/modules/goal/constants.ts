export const GOAL_STATUSES = ["ON_TRACK", "AT_RISK", "OFF_TRACK", "COMPLETED", "MISSED"] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const GOAL_STATUS_UI: Record<
  GoalStatus,
  { label: string; dot: string; badge: string; bar: string }
> = {
  ON_TRACK: {
    label: "On track",
    dot: "bg-emerald-500",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    bar: "bg-emerald-500",
  },
  AT_RISK: {
    label: "At risk",
    dot: "bg-amber-500",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    bar: "bg-amber-500",
  },
  OFF_TRACK: {
    label: "Off track",
    dot: "bg-red-500",
    badge: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    bar: "bg-red-500",
  },
  COMPLETED: {
    label: "Completed",
    dot: "bg-blue-500",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    bar: "bg-blue-500",
  },
  MISSED: {
    label: "Missed",
    dot: "bg-muted-foreground",
    badge: "bg-secondary text-secondary-foreground",
    bar: "bg-muted-foreground",
  },
};
