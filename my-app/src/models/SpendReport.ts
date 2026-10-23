import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const serviceSpendSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    mtdGross: { type: Number, default: 0 },
    today: { type: Number, default: 0 },
  },
  { _id: false },
);

const spendReportSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    // Calendar day the report covers, "YYYY-MM-DD" (not a Date — avoids TZ drift).
    date: { type: String, required: true },

    metadata: {
      awsAccount: { type: String, default: "" },
      memberAccounts: { type: String, default: "" },
      regions: { type: String, default: "" },
      environments: { type: String, default: "" },
      dataRefreshedAt: { type: Date, default: null },
      reportPulledAt: { type: Date, default: null },
      pulledBy: { type: String, default: "" },
    },

    credits: {
      program: { type: String, default: "" },
      creditId: { type: String, default: "" },
      expiryDate: { type: Date, default: null },
      servicesEligible: { type: String, default: "" },
      remaining: { type: Number, default: 0 },
      usedMtd: { type: Number, default: 0 },
    },

    spend: {
      grossMtd: { type: Number, default: 0 },
      grossToday: { type: Number, default: 0 },
      creditsAppliedMtd: { type: Number, default: 0 },
      creditsAppliedToday: { type: Number, default: 0 },
      nonCreditEligibleMtd: { type: Number, default: 0 },
      marketplaceChargesMtd: { type: Number, default: 0 },
    },

    // Bounded per day (a handful of AWS services) — embedding is fine here.
    services: {
      type: [serviceSpendSchema],
      default: [],
    },

    guardrails: {
      monthlyGrossBudget: { type: Number, default: null },
      actualAlertStatus: { type: String, enum: ["OK", "ALERT"], default: null },
      forecastAlertStatus: { type: String, enum: ["OK", "ALERT"], default: null },
      newChargeThreshold: { type: Number, default: null },
    },

    notes: {
      anomalies: { type: String, default: "" },
      actionsTaken: { type: String, default: "" },
      actionsNeeded: { type: String, default: "" },
      newChargeCategories: { type: String, default: "" },
    },

    signoff: {
      sentTo: { type: String, default: "" },
      cc: { type: String, default: "" },
      consoleTimestamp: { type: Date, default: null },
    },
  },
  { timestamps: true },
);

// One report per calendar day per workspace; -1 so "latest first" queries use the index order.
spendReportSchema.index({ workspaceId: 1, date: -1 }, { unique: true });

export type SpendReportDoc = InferSchemaType<typeof spendReportSchema>;

export const SpendReport: Model<SpendReportDoc> =
  (models.SpendReport as Model<SpendReportDoc>) ||
  model<SpendReportDoc>("SpendReport", spendReportSchema);
