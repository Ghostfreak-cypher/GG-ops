import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    // `unique` already creates the index - don't add `index: true` (avoids a duplicate-index warning).
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    image: { type: String, default: null },
    passwordHash: { type: String, default: null },
    emailVerifiedAt: { type: Date, default: undefined },
    authVersion: { type: Number, default: 0 },
    lastPasswordChangedAt: { type: Date, default: null },
    timezone: { type: String, default: null },
    jobTitle: { type: String, default: null },
    department: { type: String, default: null },
    bio: { type: String, default: null },
    pronounceUrl: { type: String, default: null },
    outOfOfficeEnabled: { type: Boolean, default: false },
    outOfOfficeFrom: { type: Date, default: null },
    outOfOfficeUntil: { type: Date, default: null },
    outOfOfficeMessage: { type: String, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema>;

// Bootstrap pattern: reuse the compiled model across HMR reloads.
export const User: Model<UserDoc> =
  (models.User as Model<UserDoc>) || model<UserDoc>("User", userSchema);
