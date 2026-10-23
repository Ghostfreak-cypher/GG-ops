"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GitBranch, X, Plus, Search } from "lucide-react";
import { addDependencyAction, removeDependencyAction } from "@/modules/task/server/actions/manage-dependency";
import type { TaskDependencies, DependencyTask } from "@/modules/task/server/queries/dependencies";
import { STATUS_UI } from "@/lib/task-ui";
import { cn } from "@/lib/utils";

type SearchablePick = { id: string; title: string; projectId: string };

export function TaskDependencies({
  slug,
  taskId,
  workspaceId,
  projectId,
  dependencies,
  searchableTasksAction,
  editable,
}: {
  slug: string;
  taskId: string;
  workspaceId: string;
  projectId: string;
  dependencies: TaskDependencies;
  /** Server-action to fetch tasks for the picker — passed so the client component stays decoupled */
  searchableTasksAction: (query: string, projectId: string) => Promise<SearchablePick[]>;
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showPicker, setShowPicker] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerResults, setPickerResults] = useState<SearchablePick[]>([]);
  const [searching, setSearching] = useState(false);

  async function search(q: string) {
    setPickerQuery(q);
    if (!q.trim()) { setPickerResults([]); return; }
    setSearching(true);
    try {
      const results = await searchableTasksAction(q, projectId);
      // Exclude the current task and already-linked tasks
      const linked = new Set([
        taskId,
        ...dependencies.blockedBy.map((t) => t.id),
        ...dependencies.blocking.map((t) => t.id),
      ]);
      setPickerResults(results.filter((r) => !linked.has(r.id)));
    } finally {
      setSearching(false);
    }
  }

  function addDep(toTaskId: string) {
    setShowPicker(false);
    setPickerQuery("");
    setPickerResults([]);
    start(async () => {
      await addDependencyAction(slug, { fromTaskId: taskId, toTaskId });
      router.refresh();
    });
  }

  function removeDep(dependencyId: string) {
    start(async () => {
      await removeDependencyAction(slug, { dependencyId });
      router.refresh();
    });
  }

  const hasAny = dependencies.blockedBy.length > 0 || dependencies.blocking.length > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <GitBranch className="size-4 text-muted-foreground" />
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Dependencies
        </p>
        {(dependencies.blockedBy.length + dependencies.blocking.length) > 0 && (
          <span className="rounded-full border border-border px-1.5 py-0.5 font-mono text-[10px]">
            {dependencies.blockedBy.length + dependencies.blocking.length}
          </span>
        )}
      </div>

      {hasAny && (
        <div className="overflow-hidden rounded-xl border border-border divide-y divide-border">
          {dependencies.blockedBy.length > 0 && (
            <>
              <div className="bg-muted/30 px-3 py-1.5">
                <p className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest">
                  Blocked by
                </p>
              </div>
              {dependencies.blockedBy.map((t) => (
                <DepRow
                  key={t.id}
                  task={t}
                  slug={slug}
                  projectId={projectId}
                  workspaceId={workspaceId}
                  editable={editable}
                  pending={pending}
                  onRemove={removeDep}
                />
              ))}
            </>
          )}
          {dependencies.blocking.length > 0 && (
            <>
              <div className="bg-muted/30 px-3 py-1.5">
                <p className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest">
                  Blocking
                </p>
              </div>
              {dependencies.blocking.map((t) => (
                <DepRow
                  key={t.id}
                  task={t}
                  slug={slug}
                  projectId={projectId}
                  workspaceId={workspaceId}
                  editable={editable}
                  pending={pending}
                  onRemove={removeDep}
                />
              ))}
            </>
          )}
        </div>
      )}

      {editable && (
        <div className="relative">
          {showPicker ? (
            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-md">
              <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <Search className="size-3.5 shrink-0 text-muted-foreground" />
                <input
                  autoFocus
                  type="text"
                  value={pickerQuery}
                  onChange={(e) => search(e.target.value)}
                  placeholder="Search tasks…"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                <button
                  type="button"
                  onClick={() => { setShowPicker(false); setPickerQuery(""); setPickerResults([]); }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              {searching && (
                <p className="px-3 py-2 text-xs text-muted-foreground">Searching…</p>
              )}
              {!searching && pickerQuery && pickerResults.length === 0 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">No tasks found.</p>
              )}
              {pickerResults.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => addDep(r.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                >
                  <span className="flex-1 truncate">{r.title}</span>
                </button>
              ))}
            </div>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => setShowPicker(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="size-3.5" />
              Add dependency
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function DepRow({
  task,
  slug,
  workspaceId: _workspaceId,
  editable,
  pending,
  onRemove,
}: {
  task: DependencyTask;
  slug: string;
  projectId: string;
  workspaceId: string;
  editable: boolean;
  pending: boolean;
  onRemove: (id: string) => void;
}) {
  const statusUi = STATUS_UI[task.status as keyof typeof STATUS_UI];
  const href = `/w/${slug}/projects/${task.projectId}/tasks/${task.id}`;

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 group hover:bg-muted/30 transition-colors">
      <span className={cn("size-2 shrink-0 rounded-full", statusUi?.dot ?? "bg-muted-foreground")} />
      <Link href={href} className="flex-1 truncate text-sm hover:underline">
        {task.title}
      </Link>
      <span className={cn("shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] uppercase", statusUi?.badge ?? "bg-muted")}>
        {statusUi?.label ?? task.status}
      </span>
      {editable && (
        <button
          type="button"
          disabled={pending}
          onClick={() => onRemove(task.id)}
          className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:p-2.5 pointer-coarse:opacity-100 transition-opacity hover:text-destructive"
          title="Remove dependency"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
