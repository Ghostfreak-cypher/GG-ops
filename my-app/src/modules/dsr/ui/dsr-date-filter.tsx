"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { format, parse } from "date-fns";
import { CalendarDays, X } from "lucide-react";
import { weeksInMonth } from "@/modules/dsr/date-window";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Deferred the same way due-date-popover.tsx defers it: PopoverContent never mounts while
// closed (confirmed by this file's own comment below on the `disabled` prop), so
// react-day-picker doesn't need to be in this route's initial bundle at all.
const Calendar = dynamic(() => import("@/components/ui/calendar").then((m) => m.Calendar), {
  ssr: false,
  loading: () => <div className="h-75.5 w-63" />,
});

/**
 * Narrows a month of reports to particular days: one date, a week of the month, or any
 * handful of days.
 *
 * Selection lives in the URL as repeated `?d=` params, so a filtered view is shareable and
 * survives a reload — and the server, not the client, decides what those days mean.
 */
export function DsrDateFilter({
  basePath,
  month,
  dates,
}: {
  basePath: string;
  /** "YYYY-MM" — the month the page is showing. The picker can't leave it. */
  month: string;
  /** Day keys already applied, already clamped to `month` by the server. */
  dates: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Calendar clicks accumulate here and reach the URL once, when the popover closes.
  // Navigating per click would cost five round trips to pick five days.
  const [draft, setDraft] = useState<string[] | null>(null);
  const current = draft ?? dates;

  const viewMonth = parse(`${month}-01`, "yyyy-MM-dd", new Date());
  const weeks = weeksInMonth(month);
  const selectedKey = [...current].sort().join(",");

  /**
   * Built fresh rather than cloned from the current query string. That's what drops the day
   * keys `MonthSwitcher` carries over when it moves to another month, and it also drops
   * `take`, so changing the filter starts again at the first page.
   */
  function apply(next: string[]) {
    const params = new URLSearchParams();
    params.set("month", month);
    for (const key of [...new Set(next)].sort()) params.append("d", key);
    router.push(`${basePath}?${params.toString()}`);
  }

  function commit(next: string[]) {
    setDraft(null);
    apply(next);
    setOpen(false);
  }

  const label =
    current.length === 0
      ? "All days"
      : current.length === 1
        ? format(parse(current[0], "yyyy-MM-dd", new Date()), "d MMM")
        : `${current.length} days`;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Closing is what commits the calendar. Escape commits too — cancelling would need
        // another state flag, and nothing here is destructive enough to want one.
        if (!next && draft) commit(draft);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Filter reports by date"
          className={cn(
            "flex h-11 shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm transition-colors hover:bg-muted sm:h-auto sm:py-1.5",
            current.length > 0 && "border-primary text-foreground",
          )}
        >
          <CalendarDays className="size-4 text-muted-foreground" />
          {label}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-auto overflow-hidden rounded-xl p-0" align="end">
        <div className="flex flex-col gap-0.5 p-2">
          {weeks.map((week, i) => (
            <button
              key={week.label}
              type="button"
              onClick={() => commit(week.dates)}
              className={cn(
                "flex items-center justify-between gap-6 rounded-lg px-2.5 py-1.5 text-sm transition-colors hover:bg-muted",
                selectedKey === week.dates.join(",")
                  ? "font-medium text-foreground"
                  : "text-muted-foreground",
              )}
            >
              <span>Week {i + 1}</span>
              <span className="text-xs text-muted-foreground">{week.label}</span>
            </button>
          ))}
        </div>

        <div className="border-t border-border" />

        <Calendar
          mode="multiple"
          // Controlled with no `onMonthChange`, and bounded to the one month, so both nav
          // arrows are disabled: the picker can't wander off the month the URL describes.
          month={viewMonth}
          startMonth={viewMonth}
          endMonth={viewMonth}
          // The wrapper defaults this on. A greyed adjacent-month day would produce a key
          // the server clamps away — a click that appears to do nothing.
          showOutsideDays={false}
          selected={current.map((key) => parse(key, "yyyy-MM-dd", new Date()))}
          onSelect={(days) => setDraft((days ?? []).map((day) => format(day, "yyyy-MM-dd")))}
          // Reads the viewer's clock, which is safe only because Radix mounts this content
          // lazily on open — it never renders during SSR, so there's nothing to mismatch.
          disabled={{ after: new Date() }}
        />

        {current.length > 0 && (
          <div className="border-t border-border p-2">
            <button
              type="button"
              onClick={() => commit([])}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
              Show the whole month
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
