import { addDays, format, parseISO } from "date-fns";
import type { SpendReportInput } from "@/modules/spend-report/schemas";

/** Precomputed date arithmetic, kept out of this module so it stays pure/testable. */
export type MonthContext = {
  today: string; // "YYYY-MM-DD"
  daysElapsed: number; // days so far this month, including today
  daysInMonth: number;
  daysRemaining: number; // daysInMonth - daysElapsed
  daysToCreditExpiry: number | null; // null when credits.expiryDate is unset
};

export const RISK_STATUSES = ["GREEN", "YELLOW", "RED"] as const;
export type RiskStatus = (typeof RISK_STATUSES)[number];

export type ServiceDerived = {
  name: string;
  mtdGross: number;
  today: number;
  pctOfMtdTotal: number;
  /** Change vs. the same service on the prior report; null when there's no prior report. */
  increaseVsPrior: number | null;
};

export type DerivedMetrics = {
  netBillableMtd: number;
  netBillableToday: number;
  avgDailyGrossBurn: number;
  /** projected (run-rate): how much daily spend the remaining credits can absorb before they expire. */
  allowedDailyBurn: number | null;
  /** projected (run-rate): days of credit runway at the current burn rate. */
  runwayDays: number | null;
  /** projected (run-rate) */
  projectedExhaustionDate: string | null;
  /** projected (run-rate) */
  projectedMonthEndGross: number;
  /** projected (run-rate) */
  projectedMonthEndNet: number;
  riskStatus: RiskStatus;
  grossChangeVsPrior: number | null;
  priorComparisonDate: string | null;
  services: ServiceDerived[];
  topServicesByMtd: ServiceDerived[];
  topServicesByIncrease: ServiceDerived[];
};

const TOP_SERVICES_BY_MTD_LIMIT = 10;
const TOP_SERVICES_BY_INCREASE_LIMIT = 5;

export function computeDerived(
  report: SpendReportInput,
  prior: SpendReportInput | null,
  ctx: MonthContext,
): DerivedMetrics {
  const { spend, credits } = report;

  const netBillableMtd = spend.grossMtd - spend.creditsAppliedMtd;
  const netBillableToday = spend.grossToday - spend.creditsAppliedToday;

  const avgDailyGrossBurn = ctx.daysElapsed > 0 ? spend.grossMtd / ctx.daysElapsed : 0;

  const allowedDailyBurn =
    ctx.daysToCreditExpiry !== null && ctx.daysToCreditExpiry > 0
      ? credits.remaining / ctx.daysToCreditExpiry
      : null;

  const runwayDays = avgDailyGrossBurn > 0 ? credits.remaining / avgDailyGrossBurn : null;

  const projectedExhaustionDate =
    runwayDays !== null
      ? format(addDays(parseISO(ctx.today), Math.floor(runwayDays)), "yyyy-MM-dd")
      : null;

  const projectedMonthEndGross = spend.grossMtd + avgDailyGrossBurn * ctx.daysRemaining;
  // Credits applied by month end can't exceed what's currently remaining.
  const projectedCreditsAppliedByMonthEnd =
    spend.creditsAppliedMtd + Math.min(credits.remaining, avgDailyGrossBurn * ctx.daysRemaining);
  const projectedMonthEndNet = projectedMonthEndGross - projectedCreditsAppliedByMonthEnd;

  const riskStatus: RiskStatus =
    projectedMonthEndGross > credits.remaining
      ? "RED"
      : allowedDailyBurn !== null && spend.grossToday > allowedDailyBurn
        ? "YELLOW"
        : "GREEN";

  const grossChangeVsPrior = prior ? spend.grossMtd - prior.spend.grossMtd : null;
  const priorComparisonDate = prior ? prior.date : null;

  const priorServiceByName = new Map((prior?.services ?? []).map((s) => [s.name, s]));
  const totalMtd = spend.grossMtd;

  const services: ServiceDerived[] = report.services.map((s) => ({
    name: s.name,
    mtdGross: s.mtdGross,
    today: s.today,
    pctOfMtdTotal: totalMtd > 0 ? s.mtdGross / totalMtd : 0,
    increaseVsPrior: prior ? s.mtdGross - (priorServiceByName.get(s.name)?.mtdGross ?? 0) : null,
  }));

  const topServicesByMtd = [...services]
    .sort((a, b) => b.mtdGross - a.mtdGross)
    .slice(0, TOP_SERVICES_BY_MTD_LIMIT);

  const topServicesByIncrease = services
    .filter((s) => s.increaseVsPrior !== null)
    .sort((a, b) => (b.increaseVsPrior as number) - (a.increaseVsPrior as number))
    .slice(0, TOP_SERVICES_BY_INCREASE_LIMIT);

  return {
    netBillableMtd,
    netBillableToday,
    avgDailyGrossBurn,
    allowedDailyBurn,
    runwayDays,
    projectedExhaustionDate,
    projectedMonthEndGross,
    projectedMonthEndNet,
    riskStatus,
    grossChangeVsPrior,
    priorComparisonDate,
    services,
    topServicesByMtd,
    topServicesByIncrease,
  };
}
