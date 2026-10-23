import { describe, it, expect } from "vitest";
import { spendReportInputSchema, spendServiceSchema } from "@/modules/spend-report/schemas";

const validInput = {
  date: "2026-07-09",
  metadata: {
    awsAccount: "123456789012",
    memberAccounts: "",
    regions: "us-east-1",
    environments: "prod",
    dataRefreshedAt: "2026-07-09T08:00:00.000Z",
    reportPulledAt: null,
    pulledBy: "Jo",
  },
  credits: {
    program: "Activate",
    creditId: "cr-1",
    expiryDate: "2026-12-31",
    servicesEligible: "EC2, S3",
    remaining: 500,
    usedMtd: 100,
  },
  spend: {
    grossMtd: 1000,
    grossToday: 50,
    creditsAppliedMtd: 100,
    creditsAppliedToday: 5,
    nonCreditEligibleMtd: 0,
    marketplaceChargesMtd: 0,
  },
  services: [{ name: "EC2", mtdGross: 600, today: 30 }],
  guardrails: {
    monthlyGrossBudget: 2000,
    actualAlertStatus: null,
    forecastAlertStatus: null,
    newChargeThreshold: 50,
  },
  notes: {
    anomalies: "",
    actionsTaken: "",
    actionsNeeded: "",
    newChargeCategories: "",
  },
  signoff: {
    sentTo: "finance@example.com",
    cc: "",
    consoleTimestamp: null,
  },
};

describe("spendReportInputSchema", () => {
  it("accepts a fully-populated report", () => {
    expect(spendReportInputSchema.safeParse(validInput).success).toBe(true);
  });

  it("fills in defaults for a minimal report", () => {
    const result = spendReportInputSchema.safeParse({ date: "2026-07-09" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.spend.grossMtd).toBe(0);
      expect(result.data.services).toEqual([]);
      expect(result.data.guardrails.monthlyGrossBudget).toBeNull();
    }
  });

  it("rejects a malformed date", () => {
    expect(
      spendReportInputSchema.safeParse({ ...validInput, date: "07-09-2026" }).success,
    ).toBe(false);
  });

  it("rejects a negative money field", () => {
    expect(
      spendReportInputSchema.safeParse({
        ...validInput,
        spend: { ...validInput.spend, grossMtd: -1 },
      }).success,
    ).toBe(false);
  });

  it("coerces numeric strings from form fields", () => {
    const result = spendReportInputSchema.safeParse({
      ...validInput,
      spend: { ...validInput.spend, grossMtd: "1000" },
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.spend.grossMtd).toBe(1000);
  });

  it("rejects an invalid guardrail alert status", () => {
    expect(
      spendReportInputSchema.safeParse({
        ...validInput,
        guardrails: { ...validInput.guardrails, actualAlertStatus: "WARN" },
      }).success,
    ).toBe(false);
  });
});

describe("spendServiceSchema", () => {
  it("requires a non-empty name", () => {
    expect(spendServiceSchema.safeParse({ name: "", mtdGross: 1, today: 1 }).success).toBe(false);
  });

  it("defaults money fields to 0", () => {
    const result = spendServiceSchema.safeParse({ name: "S3" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mtdGross).toBe(0);
      expect(result.data.today).toBe(0);
    }
  });
});
