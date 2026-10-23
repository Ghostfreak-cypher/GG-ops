import { notFound } from "next/navigation";
import { z } from "zod";
import { requireFinanceWorkspace } from "@/modules/spend-report/access";
import { getReportFormData } from "@/modules/spend-report/server/queries/get-report";
import { upsertSpendReportAction } from "@/modules/spend-report/server/actions/upsert-report";
import { ReportForm } from "@/modules/spend-report/ui/report-form";
import { ReportView } from "@/modules/spend-report/ui/report-view";
import { ReportAttachments } from "@/modules/spend-report/ui/report-attachments";

const dateParamSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export default async function SpendReportDayPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; date: string }>;
}) {
  const { date: rawDate } = await params;
  const parsedDate = dateParamSchema.safeParse(rawDate);
  if (!parsedDate.success) notFound();
  const date = parsedDate.data;

  await requireFinanceWorkspace();

  const { defaultValues, prior, derived, existing } = await getReportFormData(date);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl uppercase tracking-widest">{date}</h1>
      <ReportForm
        defaultValues={defaultValues}
        prior={prior}
        derived={derived}
        onSubmit={upsertSpendReportAction}
      />
      {existing && (
        <>
          <ReportAttachments reportId={existing.id} />
          <ReportView dto={existing} />
        </>
      )}
    </div>
  );
}
