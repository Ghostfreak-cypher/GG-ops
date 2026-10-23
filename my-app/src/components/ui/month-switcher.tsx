"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, parse } from "date-fns";

/**
 * Page a view back and forth through calendar months, via `?month=YYYY-MM`.
 *
 * The canonical implementation. `LeadMonthSwitcher` and `DsrMonthSwitcher` had drifted into
 * two near-identical copies of this; site visits needed a third, which was the point to
 * collapse them instead. Those two now delegate here and keep their own names, so no page
 * had to change.
 *
 * Other query params are preserved on the push, so switching month from a filtered view
 * keeps the filter — and `?range=` survives for when the reader switches back.
 */
export function MonthSwitcher({
  basePath,
  month,
  ariaLabelPrefix = "month",
}: {
  basePath: string;
  /** `YYYY-MM`. */
  month: string;
  /** Distinguishes the control for screen readers when a page has more than one. */
  ariaLabelPrefix?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function shift(direction: -1 | 1) {
    const date = parse(month, "yyyy-MM", new Date());
    date.setMonth(date.getMonth() + direction);

    const params = new URLSearchParams(searchParams.toString());
    params.set("month", format(date, "yyyy-MM"));
    router.push(`${basePath}?${params.toString()}`);
  }

  const label = format(parse(month, "yyyy-MM", new Date()), "MMMM yyyy");

  // size-11 on mobile is the 44px touch target; it collapses to a tighter control on sm+.
  const buttonClass =
    "flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-background transition-colors hover:bg-muted sm:size-auto sm:p-1.5";

  return (
    <div className="flex w-full items-center gap-2 sm:w-auto">
      <button
        type="button"
        onClick={() => shift(-1)}
        aria-label={`Previous ${ariaLabelPrefix}`}
        className={buttonClass}
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="flex-1 text-center font-display text-sm font-semibold sm:min-w-36 sm:flex-none">
        {label}
      </span>
      <button
        type="button"
        onClick={() => shift(1)}
        aria-label={`Next ${ariaLabelPrefix}`}
        className={buttonClass}
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
