import { z } from "zod";
import { DSR_PAGE_SIZE } from "@/modules/dsr/constants";
import { isValidObjectId } from "@/lib/mongo/ids";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A calendar day key, "YYYY-MM-DD". */
export const dsrDateKey = z.string().regex(DATE_KEY_RE, "Date must be YYYY-MM-DD");

const monthKey = z.string().regex(/^\d{4}-\d{2}$/, "Month must be YYYY-MM");

/** One thing done, and how long it took. The form's two boxes arrive combined as minutes. */
export const dsrEntrySchema = z.object({
  task: z
    .string()
    .trim()
    .min(1, "Describe what you did")
    .max(500, "Keep each item under 500 characters"),
  minutes: z.coerce
    .number()
    .int("Time must be a whole number of minutes")
    .min(1, "Log at least a minute against each item")
    .max(1440, "A day only has 24 hours"),
  /**
   * The task this line was work on, if any. Shape only — that the id names a task in
   * *this* workspace is checked in `upsertDsrFor`, which is the only place that knows
   * whose report this is. `.nullish()` so both an absent field and an explicit null
   * mean "not linked": the form sends null to unlink, MCP just omits it.
   */
  taskId: z
    .string()
    .refine(isValidObjectId, "That doesn't look like a task id")
    .nullish(),
});

export type DsrEntryInput = z.infer<typeof dsrEntrySchema>;

/**
 * Create-or-update a day's report. There's no separate create schema: re-filing the same
 * date edits that day's entry, so one shape covers both.
 *
 * `date` is bounded at "not in the future" by the action rather than here — that depends
 * on the clock, and these schemas stay pure so they can be unit-tested as pure functions.
 */
export const upsertDsrSchema = z
  .object({
    date: dsrDateKey,
    entries: z
      .array(dsrEntrySchema)
      .min(1, "Add at least one thing you worked on")
      .max(20, "Keep it to 20 items"),
    tomorrowPlan: z
      .string()
      .trim()
      .min(1, "Describe what you'll work on tomorrow")
      .max(4000, "Keep it under 4000 characters"),
  })
  // Each row is capped on its own, but only the sum catches a day that adds up to more
  // hours than a day has.
  .refine((data) => data.entries.reduce((sum, e) => sum + e.minutes, 0) <= 1440, {
    message: "That's more than 24 hours in one day",
    path: ["entries"],
  });

export type UpsertDsrInput = z.infer<typeof upsertDsrSchema>;

export const deleteDsrSchema = z.object({
  dsrId: z.string().min(1),
});

export type DeleteDsrInput = z.infer<typeof deleteDsrSchema>;

/**
 * The repeatable `?d=` day filter. One `?d=` arrives as a string and several as an array, so
 * both normalize to an array here.
 *
 * A malformed key is dropped on its own rather than failing the parse: one bad value in a
 * hand-edited URL shouldn't also cost the reader their month. Which days actually exist is
 * `clampDatesToMonth`'s job — this only enforces the shape.
 */
const dayFilter = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) =>
    (value === undefined ? [] : Array.isArray(value) ? value : [value])
      .filter((key) => DATE_KEY_RE.test(key))
      // A month has at most 31 days, so anything past that is noise the clamp would drop
      // anyway — bounded here so a long URL can't make us iterate it.
      .slice(0, 62),
  );

/**
 * `?take=` — how many reports the history renders. Bounded so the URL can't ask for the
 * world, and `.catch` rather than a hard failure so junk doesn't take the month down with it.
 */
const takeParam = z.coerce.number().int().min(1).max(200).catch(DSR_PAGE_SIZE);

/** searchParams for the month-scoped views — `.strip()` drops anything else in the URL. */
export const dsrMonthSchema = z
  .object({
    month: monthKey.optional(),
    d: dayFilter,
    take: takeParam,
  })
  .strip();

export type DsrMonthInput = z.infer<typeof dsrMonthSchema>;

/**
 * searchParams for "My DSR". `date` picks which day the form is editing, so the server
 * can prefill that day's existing report — without it, choosing an earlier date in the
 * form would silently overwrite whatever was already filed for it.
 */
export const dsrViewSchema = z
  .object({
    date: dsrDateKey.optional(),
    month: monthKey.optional(),
    d: dayFilter,
    take: takeParam,
  })
  .strip();

export type DsrViewInput = z.infer<typeof dsrViewSchema>;
