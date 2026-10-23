import { cache } from "react";
import { getDaysInMonth, differenceInCalendarDays, parseISO } from "date-fns";
import { connectDB } from "@/lib/db";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { SpendReport } from "@/models/SpendReport";
import { spendReportInputSchema, type SpendReportInput } from "@/modules/spend-report/schemas";
import {
  computeDerived,
  RISK_STATUSES,
  type MonthContext,
  type RiskStatus,
} from "@/modules/spend-report/calc";
import {
  toSpendReportDTO,
  type SpendReportDTO,
  type SpendReportPersisted,
} from "@/modules/spend-report/server/dto";

export type ListReportsFilters = {
  from?: string; // "YYYY-MM-DD", inclusive
  to?: string; // "YYYY-MM-DD", inclusive
  service?: string;
  risk?: RiskStatus;
};

export type ListReportsResult = {
  reports: SpendReportDTO[];
  serviceOptions: string[];
  page: number;
  pageSize: number;
  total: number;
};

const PAGE_SIZE = 30;

function isRiskStatus(value: string | undefined): value is RiskStatus {
  return RISK_STATUSES.includes(value as RiskStatus);
}

/** A report's own `date` stands in for "today" — MonthContext describes that day's position in its month. */
function buildMonthContext(date: string, creditsExpiryDate: string | null): MonthContext {
  const day = parseISO(date);
  const daysInMonth = getDaysInMonth(day);
  const daysElapsed = day.getDate();
  const daysToCreditExpiry = creditsExpiryDate
    ? differenceInCalendarDays(parseISO(creditsExpiryDate), day)
    : null;
  return {
    today: date,
    daysElapsed,
    daysInMonth,
    daysRemaining: daysInMonth - daysElapsed,
    daysToCreditExpiry,
  };
}

function toReportInput(doc: SpendReportPersisted): SpendReportInput {
  return spendReportInputSchema.parse({
    date: doc.date,
    metadata: {
      ...doc.metadata,
      dataRefreshedAt: doc.metadata.dataRefreshedAt?.toISOString() ?? null,
      reportPulledAt: doc.metadata.reportPulledAt?.toISOString() ?? null,
    },
    credits: {
      ...doc.credits,
      expiryDate: doc.credits.expiryDate?.toISOString() ?? null,
    },
    spend: doc.spend,
    services: doc.services,
    guardrails: doc.guardrails,
    notes: doc.notes,
    signoff: {
      ...doc.signoff,
      consoleTimestamp: doc.signoff.consoleTimestamp?.toISOString() ?? null,
    },
  });
}

/**
 * Lists reports for the finance workspace, newest first, with derived metrics attached.
 *
 * `riskStatus` isn't stored — it's computed per row from `computeDerived` — so the risk
 * filter and pagination both apply in memory after the full history is fetched. That's
 * cheap here: reports are one per calendar day, so even years of history stay small. This
 * also guarantees `prior` (the report immediately preceding a given date) is always correct,
 * even for the oldest row inside a filtered date range.
 */
export const listReports = cache(
  async (workspaceId: string, filters: ListReportsFilters, page = 1): Promise<ListReportsResult> => {
    await connectDB();

    const docs = (await SpendReport.find({ workspaceId: parseObjectIdOrThrow(workspaceId) })
      .sort({ date: -1 })
      .lean()) as unknown as SpendReportPersisted[];

    const serviceOptions = Array.from(
      new Set(docs.flatMap((doc) => doc.services.map((s) => s.name))),
    ).sort((a, b) => a.localeCompare(b));

    const ascending = [...docs].reverse();
    const dtosDescending: SpendReportDTO[] = [];
    let prior: SpendReportInput | null = null;
    for (const doc of ascending) {
      const input = toReportInput(doc);
      const ctx = buildMonthContext(input.date, input.credits.expiryDate);
      const derived = computeDerived(input, prior, ctx);
      dtosDescending.push(toSpendReportDTO(doc, derived));
      prior = input;
    }
    dtosDescending.reverse();

    const risk = isRiskStatus(filters.risk) ? filters.risk : undefined;
    const filtered = dtosDescending.filter((dto) => {
      if (filters.from && dto.date < filters.from) return false;
      if (filters.to && dto.date > filters.to) return false;
      if (filters.service && !dto.services.some((s) => s.name === filters.service)) return false;
      if (risk && dto.derived.riskStatus !== risk) return false;
      return true;
    });

    const total = filtered.length;
    const pageSize = PAGE_SIZE;
    const safePage = Math.max(1, page);
    const start = (safePage - 1) * pageSize;

    return {
      reports: filtered.slice(start, start + pageSize),
      serviceOptions,
      page: safePage,
      pageSize,
      total,
    };
  },
);
