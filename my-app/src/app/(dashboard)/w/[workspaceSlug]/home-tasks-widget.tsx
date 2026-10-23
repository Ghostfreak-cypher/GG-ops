"use client";

import * as React from "react";
import Link from "next/link";
import { format, isToday, isTomorrow } from "date-fns";
import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskPanel } from "@/components/task/task-panel";
import type { EditorMember } from "@/components/ui/rich-text-editor";
import type { MyTaskDTO } from "@/modules/dashboard/server/queries";
import type { CompletedTaskDTO } from "@/modules/dashboard/server/queries";
import type { TaskDTO } from "@/modules/task/server/dto";

type Tab = "upcoming" | "overdue" | "completed";

interface HomeTasksWidgetProps {
  workspaceSlug: string;
  userName: string | null;
  userImage?: string | null;
  upcoming: MyTaskDTO[];
  overdue: MyTaskDTO[];
  completed: CompletedTaskDTO[];
  /** Workspace members, so @mentions work in the task panel opened from here. */
  members: EditorMember[];
}

function formatDue(iso: string | null): { label: string; red: boolean } {
  if (!iso) return { label: "", red: false };
  const d = new Date(iso);
  const now = new Date();
  if (d < now && !isToday(d)) return { label: format(d, "MMM d"), red: true };
  if (isToday(d)) return { label: "Today", red: false };
  if (isTomorrow(d)) return { label: "Tomorrow", red: false };
  return { label: format(d, "MMM d"), red: false };
}

export function HomeTasksWidget({
  workspaceSlug,
  userName,
  userImage,
  upcoming,
  overdue,
  completed,
  members,
}: HomeTasksWidgetProps) {
  const [tab, setTab] = React.useState<Tab>(overdue.length > 0 ? "overdue" : "upcoming");
  const [panelTaskId, setPanelTaskId] = React.useState<string | null>(null);
  const [panelProjectId, setPanelProjectId] = React.useState<string>("");
  // Tasks hidden after being marked done from the panel, so the row disappears.
  const [hiddenIds, setHiddenIds] = React.useState<Set<string>>(() => new Set());

  function openPanel(taskId: string, projectId: string) {
    setPanelTaskId(taskId);
    setPanelProjectId(projectId);
  }

  function handleTaskUpdate(taskId: string, patch: Partial<TaskDTO>) {
    if (patch.status === "DONE") {
      setHiddenIds((prev) => new Set(prev).add(taskId));
    }
  }

  function handleArchive(taskId: string) {
    setHiddenIds((prev) => new Set(prev).add(taskId));
    setPanelTaskId(null);
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "upcoming", label: "Upcoming", count: upcoming.length || undefined },
    { key: "overdue", label: "Overdue", count: overdue.length || undefined },
    { key: "completed", label: "Completed" },
  ];

  const items = (tab === "upcoming" ? upcoming : tab === "overdue" ? overdue : completed).filter(
    (i) => !hiddenIds.has(i.id),
  );

  return (
    <>
    <div className="rounded-2xl border border-border bg-card shadow-sm">
      {/* Widget header */}
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        {userImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={userImage}
            alt={userName ?? ""}
            className="size-9 rounded-full object-cover ring-2 ring-border"
          />
        ) : (
          <span className="grid size-9 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {userName?.slice(0, 2).toUpperCase() ?? "ME"}
          </span>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            My tasks
          </div>
        </div>
        <Link
          href={`/w/${workspaceSlug}/my-tasks`}
          className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors pointer-coarse:min-h-11"
        >
          View all
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border px-5">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "relative -mb-px flex items-center gap-1.5 border-b-2 py-3 text-xs font-medium transition-colors",
              tab === t.key
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="mr-3">{t.label}</span>
            {t.count !== undefined && t.count > 0 && (
              <span
                className={cn(
                  "absolute -top-0.5 right-0 flex size-4 items-center justify-center rounded-full text-[10px] font-semibold",
                  t.key === "overdue"
                    ? "bg-red-500 text-white"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Task rows */}
      <div className="divide-y divide-border/60">
        {items.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            {tab === "completed" ? "No completed tasks in the last 2 weeks." : "You're all caught up!"}
          </p>
        ) : (
          items.slice(0, 8).map((item) => {
            if (tab === "completed") {
              const c = item as CompletedTaskDTO;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => openPanel(c.id, c.projectId)}
                  className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-muted"
                >
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground line-through">
                    {c.title}
                  </span>
                  <span className="hidden shrink-0 max-w-[120px] truncate sm:block text-xs text-muted-foreground">
                    {c.projectName}
                  </span>
                </button>
              );
            }
            const t = item as MyTaskDTO;
            const { label: dueLabel, red: dueRed } = formatDue(t.dueDate);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => openPanel(t.id, t.projectId)}
                className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-muted"
              >
                <Circle className="size-4 shrink-0 text-muted-foreground/50" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {t.title}
                </span>
                <span className="hidden shrink-0 max-w-[120px] truncate sm:block text-xs text-muted-foreground">
                  {t.projectName}
                </span>
                {dueLabel && (
                  <span
                    className={cn(
                      "shrink-0 text-xs font-medium",
                      dueRed ? "text-red-500" : "text-muted-foreground",
                    )}
                  >
                    {dueLabel}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>

      {items.length > 8 && (
        <div className="border-t border-border px-5 py-3">
          <Link
            href={`/w/${workspaceSlug}/my-tasks`}
            className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors pointer-coarse:min-h-11"
          >
            + {items.length - 8} more tasks
          </Link>
        </div>
      )}
    </div>

    <TaskPanel
      open={panelTaskId !== null}
      taskId={panelTaskId}
      projectId={panelProjectId}
      workspaceSlug={workspaceSlug}
      editable
      canManageLabels={false}
      members={members}
      labels={[]}
      onClose={() => setPanelTaskId(null)}
      onTaskUpdate={handleTaskUpdate}
      onArchive={handleArchive}
      onRefresh={() => {}}
    />
    </>
  );
}
