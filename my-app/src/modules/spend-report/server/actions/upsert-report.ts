"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import { SpendReport } from "@/models/SpendReport";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { canEditSpendReport, requireFinanceWorkspace } from "@/modules/spend-report/access";
import { computeDerived } from "@/modules/spend-report/calc";
import { buildMonthContext, toReportInput } from "@/modules/spend-report/server/queries/get-report";
import { spendReportInputSchema, type SpendReportInput } from "@/modules/spend-report/schemas";
import { toSpendReportDTO, type SpendReportDTO, type SpendReportPersisted } from "@/modules/spend-report/server/dto";
import type { ActionResult } from "@/lib/action-result";

/** The schema keeps point-in-time timestamps as raw strings; the write path parses them to Date. */
function toWriteDoc(input: SpendReportInput) {
  return {
    ...input,
    metadata: {
      ...input.metadata,
      dataRefreshedAt: input.metadata.dataRefreshedAt ? new Date(input.metadata.dataRefreshedAt) : null,
      reportPulledAt: input.metadata.reportPulledAt ? new Date(input.metadata.reportPulledAt) : null,
    },
    credits: {
      ...input.credits,
      expiryDate: input.credits.expiryDate ? new Date(input.credits.expiryDate) : null,
    },
    signoff: {
      ...input.signoff,
      consoleTimestamp: input.signoff.consoleTimestamp ? new Date(input.signoff.consoleTimestamp) : null,
    },
  };
}

export async function upsertSpendReportAction(input: unknown): Promise<ActionResult<SpendReportDTO>> {
  const { workspace, role } = await requireFinanceWorkspace();
  if (!canEditSpendReport(role)) return { ok: false, error: "You don't have permission to edit spend reports." };

  const parsed = spendReportInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await connectDB();
  const workspaceId = parseObjectIdOrThrow(workspace.id);
  const { date } = parsed.data;

  const doc = await SpendReport.findOneAndUpdate(
    { workspaceId, date },
    { $set: { ...toWriteDoc(parsed.data), workspaceId } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();

  const priorDoc = await SpendReport.findOne({ workspaceId, date: { $lt: date } })
    .sort({ date: -1 })
    .lean();
  const prior = priorDoc ? toReportInput(priorDoc) : null;

  const ctx = buildMonthContext(date, parsed.data.credits.expiryDate);
  const derived = computeDerived(parsed.data, prior, ctx);

  revalidatePath(`/w/${workspace.slug}/spend/${date}`);

  return { ok: true, data: toSpendReportDTO(doc as unknown as SpendReportPersisted, derived) };
}
