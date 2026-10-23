import type { WorkspaceRole } from "@/modules/workspace/roles";

/** Enough of a linked task to render it and build its URL — the route needs both ids. */
export type DsrLinkedTaskDTO = { title: string; projectId: string };

/**
 * One thing done, and how long it took.
 *
 * `taskId` and `linkedTask` look redundant but do different jobs. `taskId` is the raw
 * stored value and is always present when the entry was linked, so an amend (read the
 * report, resend it with one row changed) round-trips the link. `linkedTask` is the
 * resolved task and is null once that task is archived or deleted — which is exactly
 * when the render must fall back to plain text, but is *not* a reason to silently drop
 * the link from the report.
 */
export type DsrEntryDTO = {
  task: string;
  minutes: number;
  taskId: string | null;
  linkedTask: DsrLinkedTaskDTO | null;
};

/** One person's report for one day, as the client sees it. */
export type DsrDTO = {
  id: string;
  /** "YYYY-MM-DD". */
  date: string;
  entries: DsrEntryDTO[];
  totalMinutes: number;
  tomorrowPlan: string;
  user: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
};

/**
 * One row of the team DSR roster — a member plus their month at a glance.
 *
 * Deliberately just the at-a-glance facts: did they file today, and how often this month.
 * The itemised time log lives on the member's own page rather than being summarised here.
 */
export type DsrRosterEntryDTO = {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  jobTitle: string | null;
  role: WorkspaceRole;
  reportsThisMonth: number;
  /** Latest report within the month being viewed, or null if they filed none. */
  lastReportDate: string | null;
  submittedToday: boolean;
};

/** The persisted shape the mapper reads — lean() docs, ids still unknown. */
export type DsrPersisted = {
  _id: unknown;
  userId: unknown;
  date: string;
  entries: { task: string; minutes: number; taskId?: unknown }[];
  totalMinutes: number;
  tomorrowPlan: string;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * The only way to build a `DsrDTO`. `userName` and `taskById` are resolved by the caller,
 * which fetches every author and every linked task in one query each rather than
 * populating per row.
 *
 * A `taskId` with no entry in `taskById` resolves to `linkedTask: null` — that's the
 * archived-or-deleted case, and it degrades to plain text rather than a dead link. The
 * default empty map keeps the unlinked path a no-op for callers with nothing to resolve.
 */
export function toDsrDTO(
  row: DsrPersisted,
  userName: string,
  taskById: ReadonlyMap<string, DsrLinkedTaskDTO> = new Map(),
): DsrDTO {
  return {
    id: String(row._id),
    date: row.date,
    // Copied field by field: a lean() subdocument array still carries Mongoose internals
    // that would ride along into the client payload if it were passed through as-is.
    entries: row.entries.map((e) => {
      const taskId = e.taskId ? String(e.taskId) : null;
      return {
        task: e.task,
        minutes: e.minutes,
        taskId,
        linkedTask: taskId ? taskById.get(taskId) ?? null : null,
      };
    }),
    totalMinutes: row.totalMinutes,
    tomorrowPlan: row.tomorrowPlan,
    user: { id: String(row.userId), name: userName },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
