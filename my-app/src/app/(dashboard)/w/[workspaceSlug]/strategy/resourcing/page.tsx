import { notFound } from "next/navigation";
import { Users } from "lucide-react";
import { requireUser } from "@/modules/auth/server/session";
import { getWorkspaceForUser } from "@/modules/workspace/server/queries";
import { getCapacityData } from "@/modules/dashboard/server/queries/resourcing";
import { CapacityTable } from "./capacity-table";

export default async function ResourcingPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const user = await requireUser();
  const ws = await getWorkspaceForUser(workspaceSlug, user.id);
  if (!ws) notFound();

  const data = await getCapacityData(ws.id);
  const hasData = data.cells.length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Resourcing</h1>

      {!hasData ? (
        <div className="flex flex-col items-center gap-6 py-20 text-center">
          <div className="grid size-20 place-items-center rounded-2xl bg-primary/10">
            <Users className="size-10 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">
              Balance workloads and keep projects on track with resourcing
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Get the visibility you need to plan accurate timelines, adjust workloads, and keep your strategy on track.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Assign tasks with due dates to team members to see their capacity here.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/40 px-4 py-3">
            <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10">
              <Users className="size-4 text-primary" />
            </div>
            <span className="text-sm font-medium">Capacity planning</span>
            <span className="ml-auto text-xs text-muted-foreground">
              Task count per member · {data.months[0]?.label} – {data.months[data.months.length - 1]?.label}
            </span>
          </div>
          <CapacityTable data={data} />
        </>
      )}
    </div>
  );
}
