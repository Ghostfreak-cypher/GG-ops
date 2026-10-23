import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { requireUser } from "@/modules/auth/server/session";
import { getWorkspaceForUser, listMembers } from "@/modules/workspace/server/queries";
import {
  getMyTasks,
  getWorkspaceDashboard,
  getMemberCount,
  getRecentlyCompleted,
} from "@/modules/dashboard/server/queries";
import { dueBucket } from "@/modules/dashboard/dates";
import { HomeTasksWidget } from "./home-tasks-widget";

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function WorkspaceHome({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const user = await requireUser();
  const ws = await getWorkspaceForUser(workspaceSlug, user.id);
  if (!ws) notFound();

  const now = new Date();
  const [allMyTasks, data, memberCount, completed, members] = await Promise.all([
    getMyTasks(ws.id, user.id),
    getWorkspaceDashboard(ws.id, user.id),
    getMemberCount(ws.id),
    getRecentlyCompleted(ws.id, user.id),
    listMembers(ws.id),
  ]);

  const open = allMyTasks.filter((t) => t.status !== "DONE");
  const overdue = open.filter((t) => dueBucket(t.dueDate, now) === "OVERDUE");
  const upcoming = open.filter((t) => dueBucket(t.dueDate, now) !== "OVERDUE");

  const firstName = user.name?.split(" ")[0] ?? user.email?.split("@")[0] ?? "there";

  return (
    <div className="mx-auto max-w-3xl space-y-10 pb-12">
      {/* Greeting header */}
      <div className="border-b-[3px] border-border pb-6">
        <p className="font-sans text-xs uppercase tracking-widest text-muted-foreground">
          {format(now, "EEEE, MMMM d")}
        </p>
        <h1 className="mt-2 font-display text-4xl uppercase leading-none wrap-anywhere sm:text-5xl">
          {greeting(now.getHours())},<br />{firstName}
        </h1>
      </div>

      {/* Stats row */}
      {/* gap over a border-coloured background draws the 3px rules, so the dividers
          stay correct at one column as well as three — no per-cell border classes. */}
      <div className="grid grid-cols-1 gap-[3px] border-[3px] border-border bg-border sm:grid-cols-3">
        <div className="bg-background p-5">
          <p className="font-display text-4xl leading-none">{data.completedThisWeek}</p>
          <p className="mt-2 font-sans text-xs uppercase tracking-widest text-muted-foreground">
            Tasks done this week
          </p>
        </div>
        <div className="bg-background p-5">
          <p className="font-display text-4xl leading-none">{memberCount}</p>
          <p className="mt-2 font-sans text-xs uppercase tracking-widest text-muted-foreground">
            Collaborators
          </p>
        </div>
        <div className="bg-background p-5">
          <p className="font-display text-4xl leading-none">{data.projects.length}</p>
          <p className="mt-2 font-sans text-xs uppercase tracking-widest text-muted-foreground">
            Active projects
          </p>
        </div>
      </div>

      {/* My tasks widget */}
      <HomeTasksWidget
        workspaceSlug={ws.slug}
        userName={user.name ?? user.email ?? null}
        userImage={user.image ?? null}
        upcoming={upcoming}
        overdue={overdue}
        completed={completed}
        members={members.map((m) => ({
          id: m.userId,
          name: m.name,
          email: m.email,
          image: m.image,
        }))}
      />

      {/* Projects at a glance */}
      {data.projects.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-xs uppercase tracking-widest">Projects</h2>
          <div className="grid gap-[3px] border-[3px] border-border bg-border sm:grid-cols-2">
            {data.projects.slice(0, 6).map((p) => (
              <Link
                key={p.projectId}
                href={`/w/${ws.slug}/projects/${p.projectId}`}
                className="flex items-center justify-between gap-3 bg-background px-4 py-3 font-sans text-sm transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="size-2.5 shrink-0 bg-foreground" />
                  <span className="truncate font-medium">{p.projectName}</span>
                </span>
                <span className="shrink-0 border-2 border-current px-2 py-0.5 font-display text-[10px] uppercase tracking-widest">
                  {p.open} open
                </span>
              </Link>
            ))}
          </div>
          {data.projects.length > 6 && (
            <Link
              href={`/w/${ws.slug}/projects`}
              className="mt-2 inline-block font-sans text-xs text-[#0000ff] dark:text-[#6699ff] hover:underline"
            >
              View all {data.projects.length} projects →
            </Link>
          )}
        </section>
      )}
    </div>
  );
}
