import { notFound } from "next/navigation";
import { format } from "date-fns";
import { requireUser } from "@/modules/auth/server/session";
import { getWorkspaceForUser } from "@/modules/workspace/server/queries";
import { canSubmitDsr } from "@/modules/workspace/server/permissions";
import { dsrViewSchema } from "@/modules/dsr/schemas";
import { DSR_PAGE_SIZE } from "@/modules/dsr/constants";
import { formatDuration } from "@/modules/dsr/format";
import { clampDatesToMonth } from "@/modules/dsr/date-window";
import { getMyDsrForDate, getMyDsrPage } from "@/modules/dsr/server/queries";
import { getMyTasks } from "@/modules/dashboard/server/queries";
import { DsrForm } from "@/modules/dsr/ui/dsr-form";
import { DsrList } from "@/modules/dsr/ui/dsr-list";
import { DsrDateFilter } from "@/modules/dsr/ui/dsr-date-filter";
import { MonthSwitcher } from "@/components/ui/month-switcher";

/**
 * "My DSR" — the page anyone who does delivery work files their day on: what they did, how
 * long it took, and what's next. Everyone but a guest files here, maintainers and admins
 * included; reading the rest of the team is a separate page.
 */
export default async function MyDsrPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { workspaceSlug } = await params;
  const user = await requireUser();
  const ws = await getWorkspaceForUser(workspaceSlug, user.id);
  if (!ws) notFound();
  if (!canSubmitDsr(ws.role)) notFound();

  const parsed = dsrViewSchema.safeParse(await searchParams);
  const view = parsed.success
    ? parsed.data
    : { date: undefined, month: undefined, d: [], take: DSR_PAGE_SIZE };
  const today = format(new Date(), "yyyy-MM-dd");
  // A future date would be rejected by the action anyway — clamp it here so the form
  // never opens on a day it can't save.
  const date = view.date && view.date <= today ? view.date : today;
  const month = view.month ?? date.slice(0, 7);
  // Days from another month reach here whenever the month switcher moves — it preserves the
  // rest of the query string — so the window is only ever narrowed by days inside it.
  const dates = clampDatesToMonth(view.d, month);
  const basePath = `/w/${workspaceSlug}/dsr`;

  // Counts describe the whole window; only `view.take` of the reports are rendered.
  const [existing, { dsrs, hasMore, total, totalMinutes }, myTasks] = await Promise.all([
    getMyDsrForDate(ws.id, user.id, date),
    getMyDsrPage(ws.id, user.id, { month, dates }, view.take),
    getMyTasks(ws.id, user.id),
  ]);

  // What the row-level "Link task" picker offers. Your own still-open tasks: a report is a
  // log of the work you did, and the work you did is nearly always assigned to you and not
  // yet finished. Loaded here rather than searched from the client so the list is there the
  // moment the picker opens, and DONE is dropped because a finished task is rarely what
  // today's hours went on.
  const linkableTasks = myTasks
    .filter((task) => task.status !== "DONE")
    .map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      projectName: task.projectName,
    }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My DSR</h1>
        <p className="text-sm italic text-muted-foreground">
          What you did today, how long it took, and what&apos;s next.
        </p>
      </div>

      {/* key={date} reseeds the fields when the date changes — the server hands back a
          different `existing` on that navigation, and stale state would overwrite it. */}
      <DsrForm
        key={date}
        slug={ws.slug}
        basePath={basePath}
        date={date}
        maxDate={today}
        existing={existing}
        linkableTasks={linkableTasks}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-sm font-semibold">
          History
          {dates.length > 0 && ` · ${dates.length} day${dates.length === 1 ? "" : "s"} selected`} ·{" "}
          {total} report{total === 1 ? "" : "s"} · {formatDuration(totalMinutes)}
        </h2>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <DsrDateFilter basePath={basePath} month={month} dates={dates} />
          <MonthSwitcher basePath={basePath} month={month} />
        </div>
      </div>

      <DsrList
        dsrs={dsrs}
        slug={ws.slug}
        workspaceSlug={ws.slug}
        basePath={basePath}
        hasMore={hasMore}
        emptyMessage={
          dates.length > 0
            ? "Nothing filed on the selected days."
            : "No reports filed this month yet — add one above."
        }
      />
    </div>
  );
}
