import { notFound } from "next/navigation";
import { CheckSquare } from "lucide-react";
import { requireUser } from "@/modules/auth/server/session";
import { getWorkspaceForUser, listMembers } from "@/modules/workspace/server/queries";
import { getMyTasks } from "@/modules/dashboard/server/queries";
import { listLabels } from "@/modules/label/server/queries";
import { Card } from "@/components/ui/card";
import { MyTasksView } from "./my-tasks-view";

export default async function MyTasksPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const user = await requireUser();
  const ws = await getWorkspaceForUser(workspaceSlug, user.id);
  if (!ws) notFound();

  const [tasks, labels, members] = await Promise.all([
    getMyTasks(ws.id, user.id),
    listLabels(ws.id),
    listMembers(ws.id),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">My Tasks</h1>
      {tasks.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-6 text-center sm:p-10">
          <CheckSquare className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nothing assigned to you. Enjoy the calm.
          </p>
        </Card>
      ) : (
        <MyTasksView
          workspaceSlug={ws.slug}
          tasks={tasks}
          labels={labels}
          members={members.map((m) => ({
            id: m.userId,
            name: m.name,
            email: m.email,
            image: m.image,
          }))}
        />
      )}
    </div>
  );
}
