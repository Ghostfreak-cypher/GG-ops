import { cache } from "react";
import { format, subDays } from "date-fns";
import { connectDB } from "@/lib/db";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { SpendReport } from "@/models/SpendReport";
import type { SpendReportInput } from "@/modules/spend-report/schemas";
import { computeDerived } from "@/modules/spend-report/calc";
import {
  toSpendReportDTO,
  type SpendReportDTO,
  type SpendReportPersisted,
} from "@/modules/spend-report/server/dto";
import { buildMonthContext, toReportInput } from "@/modules/spend-report/server/queries/get-report";

const TREND_WINDOW_DAYS = 90;

/**
 * Reports from the last `windowDays`, oldest first, with derived metrics attached.
 * Computes derived metrics over the full history (not just the window) so `prior`
 * comparisons stay correct for the oldest row inside the window, then trims.
 */
export const listTrendReports = cache(
  async (workspaceId: string, windowDays = TREND_WINDOW_DAYS): Promise<SpendReportDTO[]> => {
    await connectDB();

    const docs = (await SpendReport.find({ workspaceId: parseObjectIdOrThrow(workspaceId) })
      .sort({ date: 1 })
      .lean()) as unknown as SpendReportPersisted[];

    const dtos: SpendReportDTO[] = [];
    let prior: SpendReportInput | null = null;
    for (const doc of docs) {
      const input = toReportInput(doc);
      const ctx = buildMonthContext(input.date, input.credits.expiryDate);
      const derived = computeDerived(input, prior, ctx);
      dtos.push(toSpendReportDTO(doc, derived));
      prior = input;
    }

    const since = format(subDays(new Date(), windowDays), "yyyy-MM-dd");
    return dtos.filter((dto) => dto.date >= since);
  },
);
