import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

export const LOGIN_PROVIDERS = ["credentials", "google"] as const;

const loginEventSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    provider: { type: String, enum: [...LOGIN_PROVIDERS], required: true },
    fingerprintHash: { type: String, required: true },
    ipMasked: { type: String, default: null },
    userAgent: { type: String, default: null },
    occurredAt: { type: Date, required: true, default: () => new Date() },
    alertSentAt: { type: Date, default: null },
  },
  { timestamps: true },
);

loginEventSchema.index({ userId: 1, occurredAt: -1 });
loginEventSchema.index({ userId: 1, fingerprintHash: 1, occurredAt: -1 });

export type LoginEventDoc = InferSchemaType<typeof loginEventSchema>;

export const LoginEvent: Model<LoginEventDoc> =
  (models.LoginEvent as Model<LoginEventDoc>) || model<LoginEventDoc>("LoginEvent", loginEventSchema);
