import type { DerivedMetrics } from "@/modules/spend-report/calc";

export type SpendReportDTO = {
  id: string;
  workspaceId: string;
  date: string;
  createdAt: string;
  updatedAt: string;

  metadata: {
    awsAccount: string;
    memberAccounts: string;
    regions: string;
    environments: string;
    dataRefreshedAt: string | null;
    reportPulledAt: string | null;
    pulledBy: string;
  };

  credits: {
    program: string;
    creditId: string;
    expiryDate: string | null;
    servicesEligible: string;
    remaining: number;
    usedMtd: number;
  };

  spend: {
    grossMtd: number;
    grossToday: number;
    creditsAppliedMtd: number;
    creditsAppliedToday: number;
    nonCreditEligibleMtd: number;
    marketplaceChargesMtd: number;
  };

  services: Array<{ name: string; mtdGross: number; today: number }>;

  guardrails: {
    monthlyGrossBudget: number | null;
    actualAlertStatus: "OK" | "ALERT" | null;
    forecastAlertStatus: "OK" | "ALERT" | null;
    newChargeThreshold: number | null;
  };

  notes: {
    anomalies: string;
    actionsTaken: string;
    actionsNeeded: string;
    newChargeCategories: string;
  };

  signoff: {
    sentTo: string;
    cc: string;
    consoleTimestamp: string | null;
  };

  /** Run-rate forecasts computed from this report + the most recent prior one. */
  derived: DerivedMetrics;
};

/** Shape of a lean SpendReport document — decoupled from Mongoose's inferred types so this stays pure. */
export type SpendReportPersisted = {
  _id: unknown;
  workspaceId: unknown;
  date: string;
  createdAt?: Date;
  updatedAt?: Date;
  metadata: {
    awsAccount: string;
    memberAccounts: string;
    regions: string;
    environments: string;
    dataRefreshedAt: Date | null;
    reportPulledAt: Date | null;
    pulledBy: string;
  };
  credits: {
    program: string;
    creditId: string;
    expiryDate: Date | null;
    servicesEligible: string;
    remaining: number;
    usedMtd: number;
  };
  spend: {
    grossMtd: number;
    grossToday: number;
    creditsAppliedMtd: number;
    creditsAppliedToday: number;
    nonCreditEligibleMtd: number;
    marketplaceChargesMtd: number;
  };
  services: Array<{ name: string; mtdGross: number; today: number }>;
  guardrails: {
    monthlyGrossBudget: number | null;
    actualAlertStatus: "OK" | "ALERT" | null;
    forecastAlertStatus: "OK" | "ALERT" | null;
    newChargeThreshold: number | null;
  };
  notes: {
    anomalies: string;
    actionsTaken: string;
    actionsNeeded: string;
    newChargeCategories: string;
  };
  signoff: {
    sentTo: string;
    cc: string;
    consoleTimestamp: Date | null;
  };
};

/** The single place that reshapes a persisted report + its derived metrics for the client. */
export function toSpendReportDTO(
  doc: SpendReportPersisted,
  derived: DerivedMetrics,
): SpendReportDTO {
  return {
    id: String(doc._id),
    workspaceId: String(doc.workspaceId),
    date: doc.date,
    createdAt: (doc.createdAt ?? new Date(0)).toISOString(),
    updatedAt: (doc.updatedAt ?? new Date(0)).toISOString(),
    metadata: {
      ...doc.metadata,
      dataRefreshedAt: doc.metadata.dataRefreshedAt?.toISOString() ?? null,
      reportPulledAt: doc.metadata.reportPulledAt?.toISOString() ?? null,
    },
    credits: {
      ...doc.credits,
      expiryDate: doc.credits.expiryDate?.toISOString() ?? null,
    },
    spend: { ...doc.spend },
    services: doc.services.map((s) => ({ ...s })),
    guardrails: { ...doc.guardrails },
    notes: { ...doc.notes },
    signoff: {
      ...doc.signoff,
      consoleTimestamp: doc.signoff.consoleTimestamp?.toISOString() ?? null,
    },
    derived,
  };
}
