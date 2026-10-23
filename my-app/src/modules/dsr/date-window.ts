import { addDays, eachDayOfInterval, eachWeekOfInterval, endOfMonth, format, parse } from "date-fns";

/**
 * Which days of a month a DSR view is showing: the whole month, or specific days inside it.
 *
 * Lives in its own module rather than in `server/queries` because the filter component needs
 * `weeksInMonth` on the client, and that file imports Mongoose.
 *
 * Every day key here is built with local-time `format(d, "yyyy-MM-dd")` and read back with
 * `parse(key, "yyyy-MM-dd", new Date())`. Not `toISOString().slice(0, 10)` and not
 * `new Date(key)` — both are UTC, and west of Greenwich they land on the previous day. The
 * rest of the module is on the server's local clock (`todayKey()` in `server/upsert.ts`).
 */
export type DsrWindow = { month: string; dates: string[] };

/**
 * The half-open day range covering a "YYYY-MM" month, as date keys.
 *
 * `date` is stored as a string whose lexicographic order is its chronological order, so a
 * plain `$gte`/`$lt` string range uses the index. A `$regex` prefix match would return the
 * same rows and scan the whole collection to do it.
 */
export function monthBounds(month: string): { from: string; to: string } {
  const [year, m] = month.split("-").map(Number);
  const next = m === 12 ? `${year + 1}-01` : `${year}-${String(m + 1).padStart(2, "0")}`;
  return { from: `${month}-01`, to: `${next}-01` };
}

/** How many days "YYYY-MM" has. Day 0 of the next month is the last day of this one. */
function daysInMonth(month: string): number {
  const [year, m] = month.split("-").map(Number);
  return new Date(Date.UTC(year, m, 0)).getUTCDate();
}

/**
 * The day keys in `dates` that really exist inside `month`, deduped and sorted.
 *
 * Two jobs. It drops days left over from another month, which is what makes the date filter
 * and the month switcher agree — `MonthSwitcher` preserves other params, so switching month
 * carries the old month's `?d=` keys along, and without this the view would come up empty.
 *
 * And it rejects days the month doesn't have: "2026-09-31" satisfies the YYYY-MM-DD regex and
 * sorts inside September, so a prefix test alone would count a day that cannot exist.
 */
export function clampDatesToMonth(dates: string[], month: string): string[] {
  const last = daysInMonth(month);
  const kept = dates.filter((key) => {
    if (!key.startsWith(`${month}-`)) return false;
    const day = Number(key.slice(8));
    return day >= 1 && day <= last;
  });
  return [...new Set(kept)].sort();
}

/**
 * The calendar weeks overlapping `month`, clipped to it — the "week of the month" shortcuts.
 *
 * Calendar weeks rather than fixed 1-7 / 8-14 blocks so each button spans exactly one visible
 * row of the calendar rendered under it. Monday-start; if the team reads "week 1" as "the
 * first seven days", that's a change to `weekStartsOn` and the interval below, nowhere else.
 */
export function weeksInMonth(month: string): { label: string; dates: string[] }[] {
  const start = parse(`${month}-01`, "yyyy-MM-dd", new Date());
  const end = endOfMonth(start);

  return eachWeekOfInterval({ start, end }, { weekStartsOn: 1 }).map((weekStart) => {
    // The week containing the 1st begins before it, so the first and last weeks get clipped.
    const days = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) }).filter(
      (day) => day >= start && day <= end,
    );
    const first = days[0];
    const lastDay = days[days.length - 1];

    return {
      label:
        days.length === 1
          ? format(first, "d MMM")
          : `${format(first, "d")} – ${format(lastDay, "d MMM")}`,
      dates: days.map((day) => format(day, "yyyy-MM-dd")),
    };
  });
}

/**
 * The `date` condition selecting a window's reports. Selected days win over the month.
 *
 * Pure, so the filtering the pages depend on is testable without a database.
 * Precondition: `dates` has already been through `clampDatesToMonth`.
 */
export function dsrDateCondition({
  month,
  dates,
}: DsrWindow): { $in: string[] } | { $gte: string; $lt: string } {
  if (dates.length > 0) return { $in: dates };

  const { from, to } = monthBounds(month);
  return { $gte: from, $lt: to };
}
