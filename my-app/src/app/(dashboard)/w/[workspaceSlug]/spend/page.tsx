import Link from "next/link";
import { requireFinanceWorkspace } from "@/modules/spend-report/access";
import { listReports } from "@/modules/spend-report/server/queries/list-reports";
import { ReportList } from "@/modules/spend-report/ui/report-list";
import { ReportFilters } from "@/modules/spend-report/ui/report-filters";
import { NewReportButton } from "@/modules/spend-report/ui/new-report-button";
import type { RiskStatus } from "@/modules/spend-report/calc";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SpendReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const access = await requireFinanceWorkspace();
  const sp = await searchParams;

  const from = firstParam(sp.from);
  const to = firstParam(sp.to);
  const service = firstParam(sp.service);
  const risk = firstParam(sp.risk) as RiskStatus | undefined;
  const page = Number(firstParam(sp.page) ?? "1") || 1;

  const { reports, serviceOptions, total, pageSize } = await listReports(
    access.workspace.id,
    { from, to, service, risk },
    page,
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const base = `/w/${access.workspace.slug}/spend`;

  function pageHref(target: number) {
    const sp = new URLSearchParams();
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    if (service) sp.set("service", service);
    if (risk) sp.set("risk", risk);
    if (target > 1) sp.set("page", String(target));
    const qs = sp.toString();
    return qs ? `${base}?${qs}` : base;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Spend Reports</h1>
          <span className="text-xs text-muted-foreground">
            {total} report{total === 1 ? "" : "s"}
          </span>
        </div>
        <NewReportButton workspaceSlug={access.workspace.slug} />
      </div>
      <ReportFilters serviceOptions={serviceOptions} current={{ from, to, service, risk }} />
      <ReportList reports={reports} workspaceSlug={access.workspace.slug} />
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 text-sm">
          <Link
            href={pageHref(Math.max(1, page - 1))}
            aria-disabled={page <= 1}
            className={
              page <= 1
                ? "pointer-events-none text-muted-foreground opacity-40"
                : "text-foreground hover:underline"
            }
          >
            Previous
          </Link>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Link
            href={pageHref(Math.min(totalPages, page + 1))}
            aria-disabled={page >= totalPages}
            className={
              page >= totalPages
                ? "pointer-events-none text-muted-foreground opacity-40"
                : "text-foreground hover:underline"
            }
          >
            Next
          </Link>
        </div>
      )}
    </div>
  );
}
