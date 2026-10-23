import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parse } from "date-fns";
import { ChevronLeft } from "lucide-react";
import { isValidObjectId } from "@/lib/mongo/ids";
import { requireUser } from "@/modules/auth/server/session";
import { getWorkspaceForUser, listMembers } from "@/modules/workspace/server/queries";
import { canViewAllDsr, canSubmitDsr } from "@/modules/workspace/server/permissions";
import { ROLE_LABELS } from "@/modules/workspace/roles";
import { dsrMonthSchema } from "@/modules/dsr/schemas";
import { DSR_PAGE_SIZE } from "@/modules/dsr/constants";
import { formatDuration } from "@/modules/dsr/format";
import { clampDatesToMonth } from "@/modules/dsr/date-window";
import { getMemberDsrPage } from "@/modules/dsr/server/queries";
import { DsrList } from "@/modules/dsr/ui/dsr-list";
import { DsrDateFilter } from "@/modules/dsr/ui/dsr-date-filter";
import { MonthSwitcher } from "@/components/ui/month-switcher";
import { Avatar } from "@/components/ui/avatar";

export default async function MemberDsrPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string; userId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { workspaceSlug, userId } = await params;
  const user = await requireUser();
  const ws = await getWorkspaceForUser(workspaceSlug, user.id);
  if (!ws) notFound();
  if (!canViewAllDsr(ws.role)) notFound();
  if (!isValidObjectId(userId)) notFound();

  // The route param names whoever the reader clicked, so it decides which reports get
  // read — it has to be re-derived as an active member of *this* workspace, not trusted.
  const members = await listMembers(ws.id);
  const member = members.find(
    (m) => m.userId === userId && m.status === "ACTIVE" && canSubmitDsr(m.role),
  );
  if (!member) notFound();

  const parsed = dsrMonthSchema.safeParse(await searchParams);
  const view = parsed.success ? parsed.data : { month: undefined, d: [], take: DSR_PAGE_SIZE };
  const month = view.month ?? format(new Date(), "yyyy-MM");
  // Days from another month reach here whenever the month switcher moves — it preserves the
  // rest of the query string — so the window is only ever narrowed by days inside it.
  const dates = clampDatesToMonth(view.d, month);
  const basePath = `/w/${workspaceSlug}/dsr/team/${userId}`;
  const monthLabel = format(parse(month, "yyyy-MM", new Date()), "MMMM yyyy");

  // Counts describe the whole window; only `view.take` of the reports are rendered.
  const { dsrs, hasMore, total, totalMinutes } = await getMemberDsrPage(
    ws.id,
    userId,
    { month, dates },
    view.take,
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/w/${workspaceSlug}/dsr/team`}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" />
        All members
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={member.name} image={member.image} size="lg" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{member.name}</h1>
            <p className="text-sm italic text-muted-foreground">
              {member.jobTitle ? `${member.jobTitle} · ` : ""}
              {ROLE_LABELS[member.role]}
            </p>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <DsrDateFilter basePath={basePath} month={month} dates={dates} />
          <MonthSwitcher basePath={basePath} month={month} />
        </div>
      </div>

      <h2 className="font-display text-sm font-semibold">
        {monthLabel}
        {dates.length > 0 && ` · ${dates.length} day${dates.length === 1 ? "" : "s"} selected`} ·{" "}
        {total} report{total === 1 ? "" : "s"} · {formatDuration(totalMinutes)}
      </h2>

      {/* Read-only: no slug and no basePath reach the list, so it renders no way to write.
          `workspaceSlug` is link-building only — it lets a reader click through to a linked
          task without handing this surface anything to act against. */}
      <DsrList
        dsrs={dsrs}
        workspaceSlug={ws.slug}
        readOnly
        hasMore={hasMore}
        emptyMessage={
          dates.length > 0
            ? `${member.name} filed nothing on the selected days.`
            : `${member.name} filed no reports in ${monthLabel}.`
        }
      />
    </div>
  );
}
