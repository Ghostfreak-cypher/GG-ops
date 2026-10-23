import { z } from "zod";

const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
// Raw form fields for a point-in-time timestamp; parsed to Date by the write path, not here.
const isoTimestampSchema = z.string().trim().min(1).nullable().default(null);
const moneySchema = z.coerce.number().min(0).default(0);
const nullableMoneySchema = z.coerce.number().min(0).nullable().default(null);

export const spendServiceSchema = z.object({
  name: z.string().trim().min(1, "Service name is required"),
  mtdGross: moneySchema,
  today: moneySchema,
});

export const spendReportInputSchema = z.object({
  date: dateStringSchema,

  metadata: z
    .object({
      awsAccount: z.string().trim().default(""),
      memberAccounts: z.string().trim().default(""),
      regions: z.string().trim().default(""),
      environments: z.string().trim().default(""),
      dataRefreshedAt: isoTimestampSchema,
      reportPulledAt: isoTimestampSchema,
      pulledBy: z.string().trim().default(""),
    })
    .prefault({}),

  credits: z
    .object({
      program: z.string().trim().default(""),
      creditId: z.string().trim().default(""),
      expiryDate: isoTimestampSchema,
      servicesEligible: z.string().trim().default(""),
      remaining: moneySchema,
      usedMtd: moneySchema,
    })
    .prefault({}),

  spend: z
    .object({
      grossMtd: moneySchema,
      grossToday: moneySchema,
      creditsAppliedMtd: moneySchema,
      creditsAppliedToday: moneySchema,
      nonCreditEligibleMtd: moneySchema,
      marketplaceChargesMtd: moneySchema,
    })
    .prefault({}),

  services: z.array(spendServiceSchema).default([]),

  guardrails: z
    .object({
      monthlyGrossBudget: nullableMoneySchema,
      actualAlertStatus: z.enum(["OK", "ALERT"]).nullable().default(null),
      forecastAlertStatus: z.enum(["OK", "ALERT"]).nullable().default(null),
      newChargeThreshold: nullableMoneySchema,
    })
    .prefault({}),

  notes: z
    .object({
      anomalies: z.string().trim().default(""),
      actionsTaken: z.string().trim().default(""),
      actionsNeeded: z.string().trim().default(""),
      newChargeCategories: z.string().trim().default(""),
    })
    .prefault({}),

  signoff: z
    .object({
      sentTo: z.string().trim().default(""),
      cc: z.string().trim().default(""),
      consoleTimestamp: isoTimestampSchema,
    })
    .prefault({}),
});

export type SpendServiceInput = z.infer<typeof spendServiceSchema>;
export type SpendReportInput = z.infer<typeof spendReportInputSchema>;
