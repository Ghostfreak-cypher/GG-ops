import { requireFinanceWorkspace } from "@/modules/spend-report/access";
import { listTrendReports } from "@/modules/spend-report/server/queries/trend-reports";
import { TrendCharts } from "@/modules/spend-report/ui/trend-charts";

export default async function SpendTrendsPage() {
  const access = await requireFinanceWorkspace();
  const reports = await listTrendReports(access.workspace.id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Spend Trends</h1>
        <span className="text-xs text-muted-foreground">Last 90 days</span>
      </div>
      <TrendCharts reports={reports} />
    </div>
  );
}
