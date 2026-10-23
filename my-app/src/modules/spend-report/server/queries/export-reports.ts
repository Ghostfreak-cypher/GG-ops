import { connectDB } from "@/lib/db";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { SpendReport } from "@/models/SpendReport";
import type { SpendReportInput } from "@/modules/spend-report/schemas";
import { computeDerived, RISK_STATUSES, type RiskStatus } from "@/modules/spend-report/calc";
import {
  toSpendReportDTO,
  type SpendReportDTO,
  type SpendReportPersisted,
} from "@/modules/spend-report/server/dto";
import { buildMonthContext, toReportInput } from "@/modules/spend-report/server/queries/get-report";

export type ExportReportsFilters = {
  from?: string; // "YYYY-MM-DD", inclusive
  to?: string; // "YYYY-MM-DD", inclusive
  service?: string;
  risk?: RiskStatus;
};

function isRiskStatus(value: string | undefined): value is RiskStatus {
  return RISK_STATUSES.includes(value as RiskStatus);
}

/**
 * Every report matching the filters, unpaginated — CSV export needs the complete set,
 * not a page of it. Derived metrics are computed over the full history first so `prior`
 * comparisons stay correct even for the oldest row inside a filtered range.
 */
export async function listReportsForExport(
  workspaceId: string,
  filters: ExportReportsFilters,
): Promise<SpendReportDTO[]> {
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

  const risk = isRiskStatus(filters.risk) ? filters.risk : undefined;
  return dtos.filter((dto) => {
    if (filters.from && dto.date < filters.from) return false;
    if (filters.to && dto.date > filters.to) return false;
    if (filters.service && !dto.services.some((s) => s.name === filters.service)) return false;
    if (risk && dto.derived.riskStatus !== risk) return false;
    return true;
  });
}
