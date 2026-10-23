import { notFound } from "next/navigation";
import { Target } from "lucide-react";
import { requireUser } from "@/modules/auth/server/session";
import { getWorkspaceForUser } from "@/modules/workspace/server/queries";
import { listProjects } from "@/modules/project/server/queries";
import { listGoals, listPeriods } from "@/modules/goal/server/queries";
import { GoalTree } from "./goal-tree";
import { CreateGoalButton } from "./create-goal-button";

export default async function GoalsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const user = await requireUser();
  const ws = await getWorkspaceForUser(workspaceSlug, user.id);
  if (!ws) notFound();

  const [goals, periods, projects] = await Promise.all([
    listGoals(ws.id),
    listPeriods(ws.id),
    listProjects(ws.id),
  ]);

  const isEmpty = goals.length === 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Goals</h1>
        {!isEmpty && (
          <CreateGoalButton workspaceSlug={workspaceSlug} goals={goals} />
        )}
      </div>

      {periods.length > 1 && (
        <div className="flex flex-wrap gap-2 text-sm">
          {periods.map((p) => (
            <span key={p} className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
              {p}
            </span>
          ))}
        </div>
      )}

      {isEmpty ? (
        <EmptyGoals workspaceSlug={workspaceSlug} />
      ) : (
        <GoalTree goals={goals} workspaceSlug={workspaceSlug} projects={projects} />
      )}
    </div>
  );
}

function EmptyGoals({ workspaceSlug }: { workspaceSlug: string }) {
  return (
    <div className="flex flex-col items-center gap-6 py-20 text-center">
      <div className="grid size-20 place-items-center rounded-2xl bg-primary/10">
        <Target className="size-10 text-primary" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">
          Connect your team&apos;s work to the outcomes that matter with goals
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Set targets, link them to real projects, and track progress automatically as work gets done.
        </p>
      </div>
      <CreateGoalButton workspaceSlug={workspaceSlug} goals={[]} primary />
    </div>
  );
}
