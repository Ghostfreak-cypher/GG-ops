import { describe, it, expect } from "vitest";
import { computeDerived, type MonthContext } from "@/modules/spend-report/calc";
import type { SpendReportInput, SpendServiceInput } from "@/modules/spend-report/schemas";

const baseCtx: MonthContext = {
  today: "2026-07-10",
  daysElapsed: 10,
  daysInMonth: 31,
  daysRemaining: 21,
  daysToCreditExpiry: 30,
};

function makeService(overrides: Partial<SpendServiceInput> = {}): SpendServiceInput {
  return { name: "EC2", mtdGross: 0, today: 0, ...overrides };
}

function makeReport(overrides: Partial<SpendReportInput> = {}): SpendReportInput {
  return {
    date: "2026-07-10",
    metadata: {
      awsAccount: "123",
      memberAccounts: "",
      regions: "us-east-1",
      environments: "prod",
      dataRefreshedAt: null,
      reportPulledAt: null,
      pulledBy: "",
    },
    credits: {
      program: "Activate",
      creditId: "cr-1",
      expiryDate: null,
      servicesEligible: "",
      remaining: 1000,
      usedMtd: 0,
    },
    spend: {
      grossMtd: 500,
      grossToday: 50,
      creditsAppliedMtd: 100,
      creditsAppliedToday: 10,
      nonCreditEligibleMtd: 0,
      marketplaceChargesMtd: 0,
    },
    services: [],
    guardrails: {
      monthlyGrossBudget: null,
      actualAlertStatus: null,
      forecastAlertStatus: null,
      newChargeThreshold: null,
    },
    notes: { anomalies: "", actionsTaken: "", actionsNeeded: "", newChargeCategories: "" },
    signoff: { sentTo: "", cc: "", consoleTimestamp: null },
    ...overrides,
  };
}

describe("computeDerived - net billable", () => {
  it("subtracts applied credits from gross", () => {
    const report = makeReport({
      spend: {
        grossMtd: 500,
        grossToday: 50,
        creditsAppliedMtd: 100,
        creditsAppliedToday: 10,
        nonCreditEligibleMtd: 0,
        marketplaceChargesMtd: 0,
      },
    });
    const result = computeDerived(report, null, baseCtx);
    expect(result.netBillableMtd).toBe(400);
    expect(result.netBillableToday).toBe(40);
  });
});

describe("computeDerived - burn rate", () => {
  it("computes average daily gross burn", () => {
    const report = makeReport({
      spend: {
        grossMtd: 500,
        grossToday: 0,
        creditsAppliedMtd: 0,
        creditsAppliedToday: 0,
        nonCreditEligibleMtd: 0,
        marketplaceChargesMtd: 0,
      },
    });
    const result = computeDerived(report, null, { ...baseCtx, daysElapsed: 10 });
    expect(result.avgDailyGrossBurn).toBe(50);
  });

  it("guards against zero daysElapsed", () => {
    const report = makeReport();
    const result = computeDerived(report, null, { ...baseCtx, daysElapsed: 0 });
    expect(result.avgDailyGrossBurn).toBe(0);
  });
});

describe("computeDerived - allowedDailyBurn", () => {
  it("divides remaining credits by days to expiry", () => {
    const report = makeReport({
      credits: {
        program: "Activate",
        creditId: "cr-1",
        expiryDate: null,
        servicesEligible: "",
        remaining: 300,
        usedMtd: 0,
      },
    });
    const result = computeDerived(report, null, { ...baseCtx, daysToCreditExpiry: 30 });
    expect(result.allowedDailyBurn).toBe(10);
  });

  it("is null when there is no credit expiry", () => {
    const report = makeReport();
    const result = computeDerived(report, null, { ...baseCtx, daysToCreditExpiry: null });
    expect(result.allowedDailyBurn).toBeNull();
  });

  it("is null when days to expiry is zero or negative", () => {
    const report = makeReport();
    expect(
      computeDerived(report, null, { ...baseCtx, daysToCreditExpiry: 0 }).allowedDailyBurn,
    ).toBeNull();
    expect(
      computeDerived(report, null, { ...baseCtx, daysToCreditExpiry: -1 }).allowedDailyBurn,
    ).toBeNull();
  });
});

describe("computeDerived - runway and exhaustion date", () => {
  it("computes runway days from remaining credits and burn rate", () => {
    const report = makeReport({
      credits: {
        program: "",
        creditId: "",
        expiryDate: null,
        servicesEligible: "",
        remaining: 500,
        usedMtd: 0,
      },
      spend: {
        grossMtd: 500,
        grossToday: 0,
        creditsAppliedMtd: 0,
        creditsAppliedToday: 0,
        nonCreditEligibleMtd: 0,
        marketplaceChargesMtd: 0,
      },
    });
    // avgDailyGrossBurn = 500/10 = 50; runway = 500/50 = 10 days
    const result = computeDerived(report, null, { ...baseCtx, daysElapsed: 10 });
    expect(result.runwayDays).toBe(10);
    expect(result.projectedExhaustionDate).toBe("2026-07-20");
  });

  it("is null when burn rate is zero", () => {
    const report = makeReport({
      spend: {
        grossMtd: 0,
        grossToday: 0,
        creditsAppliedMtd: 0,
        creditsAppliedToday: 0,
        nonCreditEligibleMtd: 0,
        marketplaceChargesMtd: 0,
      },
    });
    const result = computeDerived(report, null, baseCtx);
    expect(result.runwayDays).toBeNull();
    expect(result.projectedExhaustionDate).toBeNull();
  });
});

describe("computeDerived - month-end projections", () => {
  it("projects gross and net spend through month end", () => {
    const report = makeReport({
      credits: {
        program: "",
        creditId: "",
        expiryDate: null,
        servicesEligible: "",
        remaining: 1000,
        usedMtd: 0,
      },
      spend: {
        grossMtd: 500,
        grossToday: 0,
        creditsAppliedMtd: 100,
        creditsAppliedToday: 0,
        nonCreditEligibleMtd: 0,
        marketplaceChargesMtd: 0,
      },
    });
    const ctx: MonthContext = { ...baseCtx, daysElapsed: 10, daysRemaining: 20 };
    // avgDailyGrossBurn = 500/10 = 50; projected gross = 500 + 50*20 = 1500
    const result = computeDerived(report, null, ctx);
    expect(result.projectedMonthEndGross).toBe(1500);
    // projected credits applied = 100 + min(1000, 50*20=1000) = 1100; net = 1500-1100 = 400
    expect(result.projectedMonthEndNet).toBe(400);
  });

  it("caps projected credits applied at what remains", () => {
    const report = makeReport({
      credits: {
        program: "",
        creditId: "",
        expiryDate: null,
        servicesEligible: "",
        remaining: 200,
        usedMtd: 0,
      },
      spend: {
        grossMtd: 500,
        grossToday: 0,
        creditsAppliedMtd: 100,
        creditsAppliedToday: 0,
        nonCreditEligibleMtd: 0,
        marketplaceChargesMtd: 0,
      },
    });
    const ctx: MonthContext = { ...baseCtx, daysElapsed: 10, daysRemaining: 20 };
    // avgDailyGrossBurn = 50; projected additional = 1000, but capped at remaining=200
    // projected credits applied = 100 + 200 = 300; projectedGross = 1500; net = 1200
    const result = computeDerived(report, null, ctx);
    expect(result.projectedMonthEndNet).toBe(1200);
  });
});

describe("computeDerived - risk status", () => {
  it("is RED when projected month-end gross exceeds remaining credits", () => {
    const report = makeReport({
      credits: {
        program: "",
        creditId: "",
        expiryDate: null,
        servicesEligible: "",
        remaining: 100,
        usedMtd: 0,
      },
      spend: {
        grossMtd: 500,
        grossToday: 0,
        creditsAppliedMtd: 0,
        creditsAppliedToday: 0,
        nonCreditEligibleMtd: 0,
        marketplaceChargesMtd: 0,
      },
    });
    const result = computeDerived(report, null, baseCtx);
    expect(result.riskStatus).toBe("RED");
  });

  it("is YELLOW when today's spend exceeds the allowed daily burn but projection is safe", () => {
    const report = makeReport({
      credits: {
        program: "",
        creditId: "",
        expiryDate: null,
        servicesEligible: "",
        remaining: 10000,
        usedMtd: 0,
      },
      spend: {
        grossMtd: 100,
        grossToday: 500,
        creditsAppliedMtd: 0,
        creditsAppliedToday: 0,
        nonCreditEligibleMtd: 0,
        marketplaceChargesMtd: 0,
      },
    });
    // allowedDailyBurn = 10000/30 ≈ 333, grossToday=500 > 333 → YELLOW
    const result = computeDerived(report, null, { ...baseCtx, daysToCreditExpiry: 30 });
    expect(result.riskStatus).toBe("YELLOW");
  });

  it("is GREEN when spend is well within budget and burn rate", () => {
    const report = makeReport({
      credits: {
        program: "",
        creditId: "",
        expiryDate: null,
        servicesEligible: "",
        remaining: 10000,
        usedMtd: 0,
      },
      spend: {
        grossMtd: 100,
        grossToday: 10,
        creditsAppliedMtd: 0,
        creditsAppliedToday: 0,
        nonCreditEligibleMtd: 0,
        marketplaceChargesMtd: 0,
      },
    });
    const result = computeDerived(report, null, { ...baseCtx, daysToCreditExpiry: 30 });
    expect(result.riskStatus).toBe("GREEN");
  });

  it("does not trigger YELLOW when allowedDailyBurn is null (no expiry)", () => {
    const report = makeReport({
      credits: {
        program: "",
        creditId: "",
        expiryDate: null,
        servicesEligible: "",
        remaining: 10000,
        usedMtd: 0,
      },
      spend: {
        grossMtd: 100,
        grossToday: 99999,
        creditsAppliedMtd: 0,
        creditsAppliedToday: 0,
        nonCreditEligibleMtd: 0,
        marketplaceChargesMtd: 0,
      },
    });
    const result = computeDerived(report, null, { ...baseCtx, daysToCreditExpiry: null });
    expect(result.riskStatus).toBe("GREEN");
  });
});

describe("computeDerived - day-over-day comparison", () => {
  it("is null with no prior report", () => {
    const result = computeDerived(makeReport(), null, baseCtx);
    expect(result.grossChangeVsPrior).toBeNull();
    expect(result.priorComparisonDate).toBeNull();
  });

  it("compares against the most recent prior report, regardless of gap", () => {
    const prior = makeReport({
      date: "2026-07-07", // three days earlier — a skipped day shouldn't break this
      spend: {
        grossMtd: 300,
        grossToday: 0,
        creditsAppliedMtd: 0,
        creditsAppliedToday: 0,
        nonCreditEligibleMtd: 0,
        marketplaceChargesMtd: 0,
      },
    });
    const current = makeReport({
      spend: {
        grossMtd: 500,
        grossToday: 0,
        creditsAppliedMtd: 0,
        creditsAppliedToday: 0,
        nonCreditEligibleMtd: 0,
        marketplaceChargesMtd: 0,
      },
    });
    const result = computeDerived(current, prior, baseCtx);
    expect(result.grossChangeVsPrior).toBe(200);
    expect(result.priorComparisonDate).toBe("2026-07-07");
  });
});

describe("computeDerived - services", () => {
  it("computes pctOfMtdTotal against the report's total gross", () => {
    const report = makeReport({
      spend: {
        grossMtd: 400,
        grossToday: 0,
        creditsAppliedMtd: 0,
        creditsAppliedToday: 0,
        nonCreditEligibleMtd: 0,
        marketplaceChargesMtd: 0,
      },
      services: [makeService({ name: "EC2", mtdGross: 300 }), makeService({ name: "S3", mtdGross: 100 })],
    });
    const result = computeDerived(report, null, baseCtx);
    expect(result.services.find((s) => s.name === "EC2")?.pctOfMtdTotal).toBe(0.75);
    expect(result.services.find((s) => s.name === "S3")?.pctOfMtdTotal).toBe(0.25);
  });

  it("guards pctOfMtdTotal against a zero total", () => {
    const report = makeReport({
      spend: {
        grossMtd: 0,
        grossToday: 0,
        creditsAppliedMtd: 0,
        creditsAppliedToday: 0,
        nonCreditEligibleMtd: 0,
        marketplaceChargesMtd: 0,
      },
      services: [makeService({ name: "EC2", mtdGross: 0 })],
    });
    const result = computeDerived(report, null, baseCtx);
    expect(result.services[0].pctOfMtdTotal).toBe(0);
  });

  it("leaves increaseVsPrior null when there is no prior report", () => {
    const report = makeReport({ services: [makeService({ name: "EC2", mtdGross: 100 })] });
    const result = computeDerived(report, null, baseCtx);
    expect(result.services[0].increaseVsPrior).toBeNull();
    expect(result.topServicesByIncrease).toEqual([]);
  });

  it("computes increaseVsPrior against the matching prior service, treating a new service as a full increase", () => {
    const prior = makeReport({
      services: [makeService({ name: "EC2", mtdGross: 100 })],
    });
    const current = makeReport({
      services: [
        makeService({ name: "EC2", mtdGross: 150 }),
        makeService({ name: "Lambda", mtdGross: 40 }), // new service, no prior counterpart
      ],
    });
    const result = computeDerived(current, prior, baseCtx);
    expect(result.services.find((s) => s.name === "EC2")?.increaseVsPrior).toBe(50);
    expect(result.services.find((s) => s.name === "Lambda")?.increaseVsPrior).toBe(40);
  });

  it("ranks topServicesByMtd descending and caps at 10", () => {
    const services = Array.from({ length: 12 }, (_, i) =>
      makeService({ name: `svc-${i}`, mtdGross: i }),
    );
    const report = makeReport({ services });
    const result = computeDerived(report, null, baseCtx);
    expect(result.topServicesByMtd).toHaveLength(10);
    expect(result.topServicesByMtd[0].name).toBe("svc-11");
    expect(result.topServicesByMtd[9].name).toBe("svc-2");
  });

  it("ranks topServicesByIncrease descending, excludes nulls, and caps at 5", () => {
    const priorServices = Array.from({ length: 6 }, (_, i) =>
      makeService({ name: `svc-${i}`, mtdGross: 0 }),
    );
    const currentServices = Array.from({ length: 6 }, (_, i) =>
      makeService({ name: `svc-${i}`, mtdGross: i * 10 }),
    );
    const prior = makeReport({ services: priorServices });
    const current = makeReport({ services: currentServices });
    const result = computeDerived(current, prior, baseCtx);
    expect(result.topServicesByIncrease).toHaveLength(5);
    expect(result.topServicesByIncrease[0].name).toBe("svc-5");
    expect(result.topServicesByIncrease[0].increaseVsPrior).toBe(50);
  });
});
