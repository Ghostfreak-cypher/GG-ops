import { Schema, model, models, type Model, type InferSchemaType, type HydratedDocument } from "mongoose";

export const JOB_STATUSES = ["PENDING", "RUNNING", "DONE", "FAILED"] as const;

const jobSchema = new Schema(
  {
    name: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: [...JOB_STATUSES], default: "PENDING", required: true },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: null },
    runAfter: { type: Date, default: () => new Date() },
    lockedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

jobSchema.index({ status: 1, runAfter: 1, createdAt: 1 });
jobSchema.index({ lockedAt: 1 });

export type JobSchema = InferSchemaType<typeof jobSchema>;
export type JobDoc = HydratedDocument<JobSchema>;

export const Job: Model<JobSchema> =
  (models.Job as Model<JobSchema>) || model<JobSchema>("Job", jobSchema);