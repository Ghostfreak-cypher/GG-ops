import Link from "next/link";
import { notFound } from "next/navigation";
import { Search, SearchX, ChevronRight } from "lucide-react";
import { requireUser } from "@/modules/auth/server/session";
import { getWorkspaceForUser } from "@/modules/workspace/server/queries";
import { listProjects } from "@/modules/project/server/queries";
import { searchTasks } from "@/modules/task/server/queries";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ q?: string; projectId?: string }>;
}) {
  const { workspaceSlug } = await params;
  const { q, projectId } = await searchParams;
  const user = await requireUser();
  const ws = await getWorkspaceForUser(workspaceSlug, user.id);
  if (!ws) notFound();

  const projects = await listProjects(ws.id);
  const selectedProjectId = projects.some((project) => project.id === projectId)
    ? projectId
    : undefined;
  const query = (q ?? "").trim();
  const results = query ? await searchTasks(ws.id, query, selectedProjectId) : [];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
      <form action={`/w/${ws.slug}/search`} className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            defaultValue={query}
            placeholder="Search tasks by title or description..."
            className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm shadow-card transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <select
          name="projectId"
          defaultValue={selectedProjectId ?? ""}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All projects</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <Button type="submit">Search</Button>
      </form>

      {query &&
        (results.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 p-6 text-center sm:p-10">
            <SearchX className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No tasks match &ldquo;{query}&rdquo;.
            </p>
          </Card>
        ) : (
          <Card className="divide-y divide-border overflow-hidden p-0">
            {results.map((r) => (
              <Link
                key={r.id}
                className="group flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted"
                href={`/w/${ws.slug}/projects/${r.projectId}/tasks/${r.id}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.projectName}
                    {r.description && (
                      <span className="ml-2 text-muted-foreground/60">
                        — {r.description.replace(/<[^>]+>/g, "").slice(0, 80)}
                      </span>
                    )}
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </Card>
        ))}
    </div>
  );
}
