import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { SpendReportDTO } from "@/modules/spend-report/server/dto";
import type { RiskStatus } from "@/modules/spend-report/calc";

const RISK_UI: Record<RiskStatus, { label: string; variant: BadgeProps["variant"] }> = {
  GREEN: { label: "On track", variant: "success" },
  YELLOW: { label: "At risk", variant: "warning" },
  RED: { label: "Over budget", variant: "destructive" },
};

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function ReportList({
  reports,
  workspaceSlug,
}: {
  reports: SpendReportDTO[];
  workspaceSlug: string;
}) {
  if (reports.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 p-6 text-center sm:p-10">
        <p className="text-sm text-muted-foreground">No reports match these filters.</p>
      </Card>
    );
  }

  return (
    <Card className="divide-y divide-border">
      {reports.map((report) => {
        const risk = RISK_UI[report.derived.riskStatus];
        return (
          <Link
            key={report.id}
            href={`/w/${workspaceSlug}/spend/${report.date}`}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted"
          >
            <div className="flex items-center gap-3">
              <span className="w-24 font-mono text-sm font-medium text-foreground">
                {format(parseISO(report.date), "MMM d, yyyy")}
              </span>
              <Badge variant={risk.variant}>{risk.label}</Badge>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Net MTD
                </div>
                <div className="font-mono text-foreground">
                  {formatMoney(report.derived.netBillableMtd)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Gross today
                </div>
                <div className="font-mono text-foreground">
                  {formatMoney(report.spend.grossToday)}
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </Card>
  );
}
