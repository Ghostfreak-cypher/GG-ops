import { cache } from "react";
import { differenceInCalendarDays, getDate, getDaysInMonth, parseISO } from "date-fns";
import { connectDB } from "@/lib/db";
import { SpendReport } from "@/models/SpendReport";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { requireFinanceWorkspace } from "@/modules/spend-report/access";
import { computeDerived, type DerivedMetrics, type MonthContext } from "@/modules/spend-report/calc";
import { spendReportInputSchema, type SpendReportInput } from "@/modules/spend-report/schemas";
import {
  toSpendReportDTO,
  type SpendReportDTO,
  type SpendReportPersisted,
} from "@/modules/spend-report/server/dto";

export type ReportFormData = {
  /** Existing report + schema defaults for a new day, ready to seed `<ReportForm>`. */
  defaultValues: SpendReportInput;
  /** Most recent report before `date`, or null. */
  prior: SpendReportInput | null;
  /** Computed from `defaultValues` + `prior` — the initial live-preview snapshot. */
  derived: DerivedMetrics;
  /** The persisted report for `date`, or null when none has been saved yet. */
  existing: SpendReportDTO | null;
};

/** ctx.today is the report's own date (not the real-world "today") — see calc.ts. */
export function buildMonthContext(date: string, expiryDate: string | null): MonthContext {
  const parsed = parseISO(date);
  const daysElapsed = getDate(parsed);
  const daysInMonth = getDaysInMonth(parsed);
  return {
    today: date,
    daysElapsed,
    daysInMonth,
    daysRemaining: daysInMonth - daysElapsed,
    daysToCreditExpiry: expiryDate ? differenceInCalendarDays(parseISO(expiryDate), parsed) : null,
  };
}

/** Reshapes a lean SpendReport doc (ObjectId/Date fields) into the schema's string-based input shape. */
export function toReportInput(doc: unknown): SpendReportInput {
  return spendReportInputSchema.parse(JSON.parse(JSON.stringify(doc)));
}

export const getReportFormData = cache(async (date: string): Promise<ReportFormData> => {
  const { workspace } = await requireFinanceWorkspace();
  await connectDB();
  const workspaceId = parseObjectIdOrThrow(workspace.id);

  const [doc, priorDoc] = await Promise.all([
    SpendReport.findOne({ workspaceId, date }).lean(),
    SpendReport.findOne({ workspaceId, date: { $lt: date } })
      .sort({ date: -1 })
      .lean(),
  ]);

  const prior = priorDoc ? toReportInput(priorDoc) : null;
  const defaultValues = doc ? toReportInput(doc) : spendReportInputSchema.parse({ date });

  const ctx = buildMonthContext(date, defaultValues.credits.expiryDate);
  const derived = computeDerived(defaultValues, prior, ctx);
  const existing = doc ? toSpendReportDTO(doc as unknown as SpendReportPersisted, derived) : null;

  return { defaultValues, prior, derived, existing };
});
