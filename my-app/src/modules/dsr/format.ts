/**
 * Durations are stored as whole minutes, so they survive round-tripping exactly — 2h 20m
 * is 2.333… hours, and a decimal field can't hold that and come back the same. These two
 * helpers are the only places minutes turn into something a person reads or types.
 *
 * Deliberately not `formatWorked` from the attendance module: that renders "4:45", which
 * reads as a clock time rather than a length of time, and reaching across domains for it
 * would couple DSR to attendance for four lines of arithmetic.
 */

/** Minutes as a duration people read: "4h 45m", "2h", "45m", "0m". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Split a stored minute count back into the form's two boxes. */
export function splitDuration(minutes: number): { hours: number; minutes: number } {
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}
