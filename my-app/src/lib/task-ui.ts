import type {
  TaskStatus,
  TaskPriority,
  TaskType,
} from "@/modules/task/constants";

/** Presentation metadata for task enums. Pure constants (no React) so both
 *  Server and Client Components can share them. Badge color pairs use
 *  Tailwind's default palette at 100/700 (light) and 950/300 (dark) — both
 *  meet WCAG AA (4.5:1) contrast on their tinted backgrounds. */
export type EnumUi = {
  label: string;
  /** badge background + foreground */
  badge: string;
  /** solid dot/accent color */
  dot: string;
};

export const STATUS_UI: Record<TaskStatus, EnumUi> = {
  TODO: {
    label: "To do",
    badge: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    dot: "bg-zinc-400",
  },
  IN_PROGRESS: {
    label: "In progress",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  DONE: {
    label: "Done",
    badge:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  BLOCKED: {
    label: "Blocked",
    badge: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    dot: "bg-red-500",
  },
};

export const PRIORITY_UI: Record<TaskPriority, EnumUi> = {
  LOW: {
    label: "Low",
    badge: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    dot: "bg-zinc-400",
  },
  MEDIUM: {
    label: "Medium",
    badge: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    dot: "bg-sky-500",
  },
  HIGH: {
    label: "High",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  URGENT: {
    label: "Urgent",
    badge: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    dot: "bg-red-500",
  },
};

export const TYPE_UI: Record<TaskType, { label: string; icon?: string }> = {
  TASK: { label: "Task" },
  BUG: { label: "Bug" },
  FEATURE: { label: "Feature" },
  CHORE: { label: "Chore" },
  MILESTONE: { label: "Milestone", icon: "◆" },
};

/** Initials from a display name, for avatar fallbacks. */
export function initials(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
