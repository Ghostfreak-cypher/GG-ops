import { z } from "zod";
import { MODULE_BOARD_STATUSES } from "@/modules/module-board/constants";

const userIdSchema = z.string().trim().min(1).nullable().default(null);
const taskIdSchema = z.string().trim().min(1);

export const moduleBoardLinkSchema = z.object({
  label: z.string().trim().default(""),
  url: z.string().trim().url("Enter a valid URL"),
});

export const moduleBoardProofBundleInputSchema = z.object({
  id: z.string().trim().min(1).optional(),
  status: z.enum(MODULE_BOARD_STATUSES).default("UNSET"),
  whatVerified: z.string().trim().default(""),
  proof: z.string().trim().default(""),
  taskIds: z.array(taskIdSchema).default([]),
  externalUrls: z.array(moduleBoardLinkSchema).default([]),
  evidenceLinks: z.array(moduleBoardLinkSchema).default([]),
});

export const moduleBoardModuleInputSchema = z
  .object({
    ownerUserId: userIdSchema,
    validatorUserId: userIdSchema,
    status: z.enum(MODULE_BOARD_STATUSES),
    summary: z.string().trim().default(""),
    whatClosesIt: z.string().trim().default(""),
    verificationSummary: z.string().trim().default(""),
    validatingReason: z.string().trim().default(""),
    blockerReason: z.string().trim().default(""),
    taskIds: z.array(taskIdSchema).default([]),
    prUrls: z.array(moduleBoardLinkSchema).default([]),
    proofBundles: z.array(moduleBoardProofBundleInputSchema).default([]),
  })
  .superRefine((input, ctx) => {
    if (
      input.ownerUserId &&
      input.validatorUserId &&
      input.ownerUserId === input.validatorUserId
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Owner and validator must be different users.",
        path: ["validatorUserId"],
      });
    }
  });

export const moduleBoardStructuredRowInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  ownerUserId: userIdSchema,
  status: z.enum(MODULE_BOARD_STATUSES),
  note: z.string().trim().default(""),
  taskIds: z.array(taskIdSchema).default([]),
  externalUrls: z.array(moduleBoardLinkSchema).default([]),
});

export const moduleBoardCardInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  note: z.string().trim().default(""),
  status: z.enum(MODULE_BOARD_STATUSES),
});

export type ModuleBoardLinkInput = z.infer<typeof moduleBoardLinkSchema>;
export type ModuleBoardProofBundleInput = z.infer<
  typeof moduleBoardProofBundleInputSchema
>;
export type ModuleBoardModuleInput = z.infer<typeof moduleBoardModuleInputSchema>;
export type ModuleBoardStructuredRowInput = z.infer<
  typeof moduleBoardStructuredRowInputSchema
>;
export type ModuleBoardCardInput = z.infer<typeof moduleBoardCardInputSchema>;
