export type DueBucket = "OVERDUE" | "TODAY" | "UPCOMING" | "NONE";

/** Classify a due date (ISO) relative to `now`, comparing calendar days (UTC). */
export function dueBucket(dueIso: string | null, now: Date = new Date()): DueBucket {
  if (!dueIso) return "NONE";
  const due = dueIso.slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  if (due < today) return "OVERDUE";
  if (due === today) return "TODAY";
  return "UPCOMING";
}

export type GridCell = { iso: string; day: number; inMonth: boolean };

/** 42-cell month grid (6 weeks) starting on the Sunday on/before the 1st. */
export function buildMonthGrid(year: number, month: number): GridCell[] {
  const first = new Date(Date.UTC(year, month, 1));
  const start = new Date(first);
  start.setUTCDate(1 - first.getUTCDay());

  const cells: GridCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    cells.push({
      iso: d.toISOString().slice(0, 10),
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === month,
    });
  }
  return cells;
}
