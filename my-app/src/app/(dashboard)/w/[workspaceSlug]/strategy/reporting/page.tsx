import { notFound } from "next/navigation";
import { BarChart2 } from "lucide-react";
import { requireUser } from "@/modules/auth/server/session";
import { getWorkspaceForUser } from "@/modules/workspace/server/queries";
import { getReportingData } from "@/modules/dashboard/server/queries/reporting";
import { DashboardCharts } from "./dashboard-charts";

export default async function ReportingPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const user = await requireUser();
  const ws = await getWorkspaceForUser(workspaceSlug, user.id);
  if (!ws) notFound();

  const data = await getReportingData(ws.id);
  const hasData = data.byStatus.some((s) => s.count > 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Reporting</h1>

      {!hasData ? (
        <div className="flex flex-col items-center gap-6 py-20 text-center">
          <div className="grid size-20 place-items-center rounded-2xl bg-primary/10">
            <BarChart2 className="size-10 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">
              Uncover the state of your team&apos;s work with reporting
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Build dashboards in minutes and turn your team&apos;s work into insights you can act on.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Create tasks in your projects to see data here.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/40 px-4 py-3">
            <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10">
              <BarChart2 className="size-4 text-primary" />
            </div>
            <span className="text-sm font-medium">Team work dashboard</span>
          </div>
          <DashboardCharts data={data} />
        </>
      )}
    </div>
  );
}
