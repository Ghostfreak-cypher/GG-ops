import { notFound } from "next/navigation";
import { format, parse } from "date-fns";
import { requireUser } from "@/modules/auth/server/session";
import { getWorkspaceForUser } from "@/modules/workspace/server/queries";
import { canViewAllDsr } from "@/modules/workspace/server/permissions";
import { dsrMonthSchema } from "@/modules/dsr/schemas";
import { getDsrRoster } from "@/modules/dsr/server/queries";
import { MonthSwitcher } from "@/components/ui/month-switcher";
import { DsrRoster } from "@/modules/dsr/ui/dsr-roster";

export default async function DsrTeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { workspaceSlug } = await params;
  const user = await requireUser();
  const ws = await getWorkspaceForUser(workspaceSlug, user.id);
  if (!ws) notFound();
  if (!canViewAllDsr(ws.role)) notFound();

  const parsed = dsrMonthSchema.safeParse(await searchParams);
  const today = format(new Date(), "yyyy-MM-dd");
  const month = (parsed.success ? parsed.data.month : undefined) ?? today.slice(0, 7);
  const basePath = `/w/${workspaceSlug}/dsr/team`;

  const entries = await getDsrRoster(ws.id, month, today);

  const filedToday = entries.filter((e) => e.submittedToday).length;
  const totalReports = entries.reduce((sum, e) => sum + e.reportsThisMonth, 0);
  const monthLabel = format(parse(month, "yyyy-MM", new Date()), "MMMM yyyy");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team DSR</h1>
          <p className="text-sm italic text-muted-foreground">
            Daily status reports across {ws.name}. Pick a name to read their reports day by day.
          </p>
        </div>
        <MonthSwitcher basePath={basePath} month={month} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Filed today" value={`${filedToday}/${entries.length}`} />
        <Stat label={`Reports · ${monthLabel}`} value={String(totalReports)} />
        <Stat label="Reporting" value={`${entries.length} people`} />
      </div>

      <DsrRoster entries={entries} basePath={basePath} monthLabel={monthLabel} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border p-3">
      <div className="font-display font-semibold text-[10px] tracking-normal text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-display font-semibold text-2xl tabular-nums">{value}</div>
    </div>
  );
}
