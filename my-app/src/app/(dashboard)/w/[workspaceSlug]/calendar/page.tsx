import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/modules/auth/server/session";
import { getWorkspaceForUser } from "@/modules/workspace/server/queries";
import { getMyTasks, type MyTaskDTO } from "@/modules/dashboard/server/queries";
import { buildMonthGrid } from "@/modules/dashboard/dates";
import { STATUS_UI } from "@/lib/task-ui";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n: number) => String(n).padStart(2, "0");

export default async function CalendarPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const user = await requireUser();
  const ws = await getWorkspaceForUser(workspaceSlug, user.id);
  if (!ws) notFound();

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const grid = buildMonthGrid(year, month);
  const monthLabel = new Date(Date.UTC(year, month, 1)).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const todayIso = `${year}-${pad(month + 1)}-${pad(now.getUTCDate())}`;

  const tasks = await getMyTasks(ws.id, user.id);
  const byDay = new Map<string, MyTaskDTO[]>();
  for (const t of tasks) {
    if (!t.dueDate) continue;
    const k = t.dueDate.slice(0, 10);
    const arr = byDay.get(k) ?? [];
    arr.push(t);
    byDay.set(k, arr);
  }

  // Days with something due — the mobile agenda skips empty ones entirely.
  const agendaDays = grid.filter(
    (cell) => cell.inMonth && (byDay.get(cell.iso)?.length ?? 0) > 0,
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        Calendar
        <span className="ml-2 text-base font-normal text-muted-foreground">
          {monthLabel}
        </span>
      </h1>
      {/* Seven columns give ~47px cells on a phone, so below md the same byDay map
          renders as an agenda list instead. No extra query. */}
      <div className="hidden grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border text-xs shadow-card md:grid">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="bg-card px-2 py-1.5 text-center font-medium text-muted-foreground"
          >
            {d}
          </div>
        ))}
        {grid.map((cell) => {
          const items = byDay.get(cell.iso) ?? [];
          const isToday = cell.iso === todayIso;
          return (
            <div
              key={cell.iso}
              className={cn(
                "min-h-24 bg-card p-1.5",
                !cell.inMonth && "bg-muted/40 text-muted-foreground",
              )}
            >
              <div className="flex justify-end">
                <span
                  className={cn(
                    "grid size-5 place-items-center rounded-full text-[10px]",
                    isToday
                      ? "bg-primary font-semibold text-primary-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {cell.day}
                </span>
              </div>
              <ul className="mt-0.5 space-y-0.5">
                {items.slice(0, 3).map((t) => (
                  <li key={t.id}>
                    <Link
                      className="flex items-center gap-1 truncate rounded bg-muted px-1 py-0.5 transition-colors hover:bg-secondary"
                      href={`/w/${ws.slug}/projects/${t.projectId}/tasks/${t.id}`}
                    >
                      <span
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          STATUS_UI[t.status].dot,
                        )}
                      />
                      <span className="truncate">{t.title}</span>
                    </Link>
                  </li>
                ))}
                {items.length > 3 && (
                  <li className="px-1 text-[10px] text-muted-foreground">
                    +{items.length - 3} more
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
      <ul className="space-y-2 md:hidden">
        {agendaDays.length === 0 ? (
          <li className="border border-border p-4 text-center text-sm text-muted-foreground">
            Nothing due this month.
          </li>
        ) : (
          agendaDays.map((cell) => (
              <li key={cell.iso} className="border border-border">
                <div
                  className={cn(
                    "flex items-baseline gap-2 border-b border-border px-3 py-1.5 font-mono text-[10px] uppercase",
                    cell.iso === todayIso
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/40 text-muted-foreground",
                  )}
                >
                  <span className="font-display text-sm">{cell.day}</span>
                  <span>
                    {new Date(`${cell.iso}T00:00:00Z`).toLocaleDateString("en-US", {
                      weekday: "long",
                      timeZone: "UTC",
                    })}
                  </span>
                </div>
                <ul className="divide-y divide-border">
                  {(byDay.get(cell.iso) ?? []).map((t) => (
                    <li key={t.id}>
                      <Link
                        className="flex items-center gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-muted"
                        href={`/w/${ws.slug}/projects/${t.projectId}/tasks/${t.id}`}
                      >
                        <span
                          className={cn("size-2 shrink-0 rounded-full", STATUS_UI[t.status].dot)}
                        />
                        <span className="min-w-0 flex-1 wrap-anywhere">{t.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))
        )}
      </ul>

      <p className="text-xs text-muted-foreground">
        Tasks assigned to you with a due date this month.
      </p>
    </div>
  );
}
