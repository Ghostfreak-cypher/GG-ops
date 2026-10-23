import { notFound } from "next/navigation";
import { requireUser } from "@/modules/auth/server/session";
import { getWorkspaceForUser, listMembers } from "@/modules/workspace/server/queries";
import { listProjects } from "@/modules/project/server/queries";
import { canEditTasks } from "@/modules/workspace/server/permissions";
import { listDrafts } from "@/modules/task-draft/server/queries";
import { DraftList } from "./draft-list";

export default async function DraftsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const user = await requireUser();
  const ws = await getWorkspaceForUser(workspaceSlug, user.id);
  if (!ws) notFound();

  const canReview = canEditTasks(ws.role);

  const [drafts, members, projects] = await Promise.all([
    listDrafts(ws.id, { status: "PENDING" }),
    listMembers(ws.id),
    listProjects(ws.id),
  ]);

  const assignable = members.map((m) => ({ id: m.userId, name: m.name, image: m.image ?? null }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Task drafts</h1>
        <p className="text-sm text-muted-foreground">
          {drafts.length} pending draft{drafts.length !== 1 ? "s" : ""} — suggested from meeting
          notes, waiting on a human before they become real tasks.
        </p>
      </div>

      <DraftList
        drafts={drafts}
        slug={ws.slug}
        members={assignable}
        projects={projects}
        canReview={canReview}
      />
    </div>
  );
}
