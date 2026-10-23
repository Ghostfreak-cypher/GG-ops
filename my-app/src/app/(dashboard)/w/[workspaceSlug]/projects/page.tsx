import Link from "next/link";
import { notFound } from "next/navigation";
import { Folder, ChevronRight } from "lucide-react";
import { requireUser } from "@/modules/auth/server/session";
import { getWorkspaceForUser } from "@/modules/workspace/server/queries";
import { listProjects } from "@/modules/project/server/queries";
import { Card } from "@/components/ui/card";
import { CreateProjectForm } from "./create-project-form";

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const user = await requireUser();
  const ws = await getWorkspaceForUser(workspaceSlug, user.id);
  if (!ws) notFound();

  const projects = await listProjects(ws.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
      <CreateProjectForm slug={ws.slug} />

      {projects.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-6 text-center sm:p-10">
          <Folder className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No projects yet. Create your first one above.
          </p>
        </Card>
      ) : (
        <Card className="divide-y divide-border overflow-hidden p-0">
          {projects.map((p) => (
            <Link
              key={p.id}
              className="group flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted"
              href={`/w/${ws.slug}/projects/${p.id}`}
            >
              <span
                className="grid size-8 shrink-0 place-items-center rounded-md text-white"
                style={{ backgroundColor: p.color ?? "#4f46e5" }}
              >
                <Folder className="size-4" />
              </span>
              <span className="flex-1 truncate font-medium">{p.name}</span>
              <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
