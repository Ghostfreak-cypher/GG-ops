import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from "mongoose";
import { MODULE_BOARD_STATUSES } from "@/modules/module-board/constants";

const linkRecordSchema = new Schema(
  {
    label: { type: String, default: "" },
    url: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const proofBundleSchema = new Schema(
  {
    id: { type: String, required: true },
    status: { type: String, enum: [...MODULE_BOARD_STATUSES], default: "UNSET" },
    whatVerified: { type: String, default: "" },
    proof: { type: String, default: "" },
    taskIds: [{ type: Schema.Types.ObjectId, ref: "Task" }],
    externalUrls: { type: [linkRecordSchema], default: [] },
    evidenceLinks: { type: [linkRecordSchema], default: [] },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedAt: { type: Date, default: null },
  },
  { _id: false },
);

const moduleRowSchema = new Schema(
  {
    id: { type: String, required: true },
    moduleKey: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    ownerUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    validatorUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      validate: {
        validator(this: { ownerUserId?: unknown }, value: unknown) {
          return !value || !this.ownerUserId || String(value) !== String(this.ownerUserId);
        },
        message: "Owner and validator must be different users.",
      },
    },
    status: { type: String, enum: [...MODULE_BOARD_STATUSES], default: "UNSET" },
    summary: { type: String, default: "" },
    whatClosesIt: { type: String, default: "" },
    verificationSummary: { type: String, default: "" },
    validatingReason: { type: String, default: "" },
    blockerReason: { type: String, default: "" },
    taskIds: [{ type: Schema.Types.ObjectId, ref: "Task" }],
    prUrls: { type: [linkRecordSchema], default: [] },
    proofBundles: { type: [proofBundleSchema], default: [] },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedAt: { type: Date, default: null },
  },
  { _id: false },
);

const structuredRowSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    ownerUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    status: { type: String, enum: [...MODULE_BOARD_STATUSES], default: "UNSET" },
    note: { type: String, default: "" },
    taskIds: [{ type: Schema.Types.ObjectId, ref: "Task" }],
    externalUrls: { type: [linkRecordSchema], default: [] },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedAt: { type: Date, default: null },
  },
  { _id: false },
);

const cardSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    note: { type: String, default: "" },
    status: { type: String, enum: [...MODULE_BOARD_STATUSES], default: "UNSET" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedAt: { type: Date, default: null },
  },
  { _id: false },
);

const moduleBoardSchema = new Schema(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      unique: true,
    },
    finishLines: { type: [cardSchema], default: [] },
    masterGate: { type: [cardSchema], default: [] },
    modules: { type: [moduleRowSchema], default: [] },
    pilotRoadmap: { type: [structuredRowSchema], default: [] },
    openItems: { type: [structuredRowSchema], default: [] },
    outreachPipeline: { type: [structuredRowSchema], default: [] },
    spendDiscipline: { type: [structuredRowSchema], default: [] },
    loadFlags: { type: [structuredRowSchema], default: [] },
    scopeHolds: { type: [cardSchema], default: [] },
    lastUpdatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

moduleBoardSchema.index({ workspaceId: 1 }, { unique: true });

export type ModuleBoardDoc = InferSchemaType<typeof moduleBoardSchema>;
export type ModuleBoardHydratedDocument = HydratedDocument<ModuleBoardDoc>;

export const ModuleBoard: Model<ModuleBoardDoc> =
  (models.ModuleBoard as Model<ModuleBoardDoc>) ||
  model<ModuleBoardDoc>("ModuleBoard", moduleBoardSchema);
