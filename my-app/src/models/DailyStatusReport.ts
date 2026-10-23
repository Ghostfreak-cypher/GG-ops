import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const dailyStatusReportSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    // The person the report is about, and the only person who may write it. Always set
    // server-side from the session, never client-supplied.
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // A plain "YYYY-MM-DD" key, not a Date — the same discipline the spend report uses.
    // A report is about a calendar day, so storing an instant would only invite the
    // timezone drift that turns "yesterday's report" into "two days ago" for half the team.
    // Lexicographic ordering matches chronological ordering, so range queries work directly.
    date: { type: String, required: true },
    // The day itemised: one row per thing done, with how long it took. Ordered values
    // rather than addressable records, so no per-row _id.
    entries: {
      type: [
        {
          _id: false,
          task: { type: String, required: true, trim: true },
          // Whole minutes. Hours as a decimal can't hold 2h 20m and hand it back
          // unchanged, and these numbers get summed across a whole month.
          minutes: { type: Number, required: true, min: 1, max: 1440 },
          // Optional link to the task this work was on. `task` above stays the
          // human sentence — this is the machine tie, so a report can be read back
          // against the board. Unindexed: entries are never queried by task, only
          // resolved by id when a report is rendered. Verified to be in the report's
          // own workspace on write (upsertDsrFor), never trusted from the client.
          taskId: { type: Schema.Types.ObjectId, ref: "Task", default: null },
        },
      ],
      required: true,
    },
    // Sum of entries[].minutes, recomputed server-side on every write. Denormalized so
    // the maintainer's roster can $sum one field instead of unwinding the array.
    totalMinutes: { type: Number, required: true, min: 1, max: 1440 },
    tomorrowPlan: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

// One report per person per day. Also the index the upsert filter and the per-member
// date-wise view both ride on.
dailyStatusReportSchema.index({ workspaceId: 1, userId: 1, date: 1 }, { unique: true });

// The maintainer's roster: every report in the workspace across a month.
dailyStatusReportSchema.index({ workspaceId: 1, date: -1 });

export type DailyStatusReportDoc = InferSchemaType<typeof dailyStatusReportSchema>;

// This repo bootstraps models inline rather than through a registerModel helper — same
// HMR-safety guarantee, matching every other model in src/models/.
export const DailyStatusReport: Model<DailyStatusReportDoc> =
  (models.DailyStatusReport as Model<DailyStatusReportDoc>) ||
  model<DailyStatusReportDoc>("DailyStatusReport", dailyStatusReportSchema);
