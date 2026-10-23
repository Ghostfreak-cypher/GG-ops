import Link from "next/link";
import { format, parse } from "date-fns";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataCard, DataCardField, DataCardList } from "@/components/ui/data-card-list";
import { ROLE_LABELS } from "@/modules/workspace/roles";
import type { DsrRosterEntryDTO } from "@/modules/dsr/server/dto";

function formatDay(date: string | null): string {
  return date ? format(parse(date, "yyyy-MM-dd", new Date()), "d MMM") : "—";
}

/**
 * The team DSR landing view: everyone expected to file, and how their month is going.
 * Every name links through to that person's reports, date by date.
 */
export function DsrRoster({
  entries,
  basePath,
  monthLabel,
}: {
  entries: DsrRosterEntryDTO[];
  /** `/w/<slug>/dsr/team` — each row appends its own userId. */
  basePath: string;
  monthLabel: string;
}) {
  if (entries.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 p-6 text-center sm:p-10">
        <p className="text-sm italic text-muted-foreground">
          No members file daily status reports in this workspace yet — invite your team first.
        </p>
      </Card>
    );
  }

  return (
    <>
      {/* Six short values per row scan far better as a grid; a min-width lets it scroll
          rather than crush the columns, and the card list below takes over on mobile. */}
      <div className="hidden overflow-x-auto border border-border md:block">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="bg-muted/40 text-left font-display font-semibold text-[10px] tracking-normal">
              <th className="px-3 py-2">Member</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2 text-right">Reports</th>
              <th className="px-3 py-2">Last report</th>
              <th className="px-3 py-2">Today</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.userId} className="border-t border-border">
                <td className="px-3 py-2">
                  <Link
                    href={`${basePath}/${entry.userId}`}
                    className="flex items-center gap-2 font-medium hover:text-primary hover:underline underline-offset-2"
                  >
                    <Avatar name={entry.name} image={entry.image} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate">{entry.name}</span>
                      {entry.jobTitle ? (
                        <span className="block truncate text-xs font-normal text-muted-foreground">
                          {entry.jobTitle}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{ROLE_LABELS[entry.role]}</td>
                <td className="px-3 py-2 text-right tabular-nums">{entry.reportsThisMonth}</td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">
                  {formatDay(entry.lastReportDate)}
                </td>
                <td className="px-3 py-2">
                  <TodayBadge submitted={entry.submittedToday} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DataCardList className="md:hidden">
        {entries.map((entry) => (
          <DataCard
            key={entry.userId}
            leading={<Avatar name={entry.name} image={entry.image} size="md" />}
            title={
              <Link href={`${basePath}/${entry.userId}`} className="hover:text-primary">
                {entry.name}
              </Link>
            }
            subtitle={entry.jobTitle ?? ROLE_LABELS[entry.role]}
            actions={<TodayBadge submitted={entry.submittedToday} />}
          >
            <DataCardField label={`Reports (${monthLabel})`}>
              {entry.reportsThisMonth}
            </DataCardField>
            <DataCardField label="Last report">{formatDay(entry.lastReportDate)}</DataCardField>
            <DataCardField label="Role">{ROLE_LABELS[entry.role]}</DataCardField>
          </DataCard>
        ))}
      </DataCardList>
    </>
  );
}

function TodayBadge({ submitted }: { submitted: boolean }) {
  return submitted ? (
    <Badge variant="success">Filed</Badge>
  ) : (
    <Badge variant="warning">Pending</Badge>
  );
}
