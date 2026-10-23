"use client";

import * as React from "react";
import {
  AlertCircle,
  CalendarClock,
  CalendarDays,
  CircleDashed,
  CheckCircle2,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { TaskPanel } from "@/components/task/task-panel";
import type { EditorMember } from "@/components/ui/rich-text-editor";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { dueBucket, type DueBucket } from "@/modules/dashboard/dates";
import type { MyTaskDTO } from "@/modules/dashboard/server/queries";
import type { LabelDTO } from "@/modules/label/server/queries";
import type { TaskDTO } from "@/modules/task/server/dto";
import { MyTasksToolbar } from "./my-tasks-toolbar";
import {
  applyMyTaskFilters,
  EMPTY_MY_TASK_FILTERS,
  type MyTaskFilters,
  type FilterOption,
} from "./my-tasks-filters";

const ORDER: {
  key: DueBucket;
  label: string;
  icon: LucideIcon;
  iconClass: string;
}[] = [
  { key: "OVERDUE", label: "Overdue", icon: AlertCircle, iconClass: "text-red-500" },
  { key: "TODAY", label: "Today", icon: CalendarClock, iconClass: "text-blue-500" },
  { key: "UPCOMING", label: "Upcoming", icon: CalendarDays, iconClass: "text-muted-foreground" },
  { key: "NONE", label: "No due date", icon: CircleDashed, iconClass: "text-muted-foreground" },
];

interface MyTasksViewProps {
  workspaceSlug: string;
  tasks: MyTaskDTO[];
  labels: LabelDTO[];
  /** Workspace members, so @mentions work in the task panel opened from here. */
  members: EditorMember[];
}

export function MyTasksView({
  workspaceSlug,
  tasks: initialTasks,
  labels,
  members,
}: MyTasksViewProps) {
  const [tasks, setTasks] = React.useState<MyTaskDTO[]>(initialTasks);
  const [filters, setFilters] = React.useState<MyTaskFilters>(EMPTY_MY_TASK_FILTERS);
  const [showCompleted, setShowCompleted] = React.useState(true);
  const [panelTaskId, setPanelTaskId] = React.useState<string | null>(null);
  const [panelProjectId, setPanelProjectId] = React.useState<string>("");

  function openPanel(taskId: string, projectId: string) {
    setPanelTaskId(taskId);
    setPanelProjectId(projectId);
  }

  function handleTaskUpdate(taskId: string, patch: Partial<TaskDTO>) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id !== taskId
          ? t
          : {
              ...t,
              ...(patch.status !== undefined ? { status: patch.status } : {}),
              ...(patch.title !== undefined ? { title: patch.title } : {}),
              ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate } : {}),
              // Keep the Completed section accurate when status flips.
              ...(patch.status !== undefined
                ? {
                    completedAt:
                      patch.status === "DONE"
                        ? (t.completedAt ?? new Date().toISOString())
                        : null,
                  }
                : {}),
            },
      ),
    );
  }

  function handleArchive(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setPanelTaskId(null);
  }

  // Filter option lists derived from the current task set.
  const projectOptions: FilterOption[] = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of tasks) if (!seen.has(t.projectId)) seen.set(t.projectId, t.projectName);
    return [...seen.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const labelOptions: FilterOption[] = React.useMemo(() => {
    const used = new Set(tasks.flatMap((t) => t.labelIds));
    return labels.filter((l) => used.has(l.id)).map((l) => ({ id: l.id, name: l.name, color: l.color }));
  }, [tasks, labels]);

  const filtered = applyMyTaskFilters(tasks, filters);
  const active = filtered.filter((t) => t.status !== "DONE");
  const completed = filtered
    .filter((t) => t.status === "DONE")
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));

  const now = new Date();
  const buckets = new Map<DueBucket, MyTaskDTO[]>();
  for (const t of active) {
    const b = dueBucket(t.dueDate, now);
    const arr = buckets.get(b) ?? [];
    arr.push(t);
    buckets.set(b, arr);
  }

  const nothingMatches = active.length === 0 && completed.length === 0;

  return (
    <div className="space-y-5">
      <MyTasksToolbar
        filters={filters}
        onChange={setFilters}
        projectOptions={projectOptions}
        labelOptions={labelOptions}
      />

      {nothingMatches ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No tasks match your filters.
        </Card>
      ) : (
        <div className="space-y-6">
          {ORDER.map(({ key, label, icon: Icon, iconClass }) => {
            const items = buckets.get(key) ?? [];
            if (items.length === 0) return null;
            const overdue = key === "OVERDUE";
            return (
              <section key={key} className="space-y-2">
                <SectionHeader icon={Icon} iconClass={iconClass} label={label} count={items.length} />
                <Card className="divide-y divide-border overflow-hidden p-0">
                  {items.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      onClick={() => openPanel(t.id, t.projectId)}
                      trailing={
                        t.dueDate ? (
                          <span
                            className={cn(
                              "text-xs",
                              overdue ? "font-medium text-[#ff0000]" : "text-muted-foreground",
                            )}
                          >
                            {t.dueDate.slice(0, 10)}
                          </span>
                        ) : null
                      }
                    />
                  ))}
                </Card>
              </section>
            );
          })}

          {completed.length > 0 && (
            <section className="space-y-2">
              <button
                type="button"
                onClick={() => setShowCompleted((v) => !v)}
                className="flex w-full items-center gap-2 border-b-[3px] border-border pb-2"
              >
                <CheckCircle2 className="size-4 text-emerald-500" />
                <span className="font-display text-xs uppercase tracking-widest">Completed</span>
                <span className="font-sans text-xs text-muted-foreground">{completed.length}</span>
                <ChevronDown
                  className={cn(
                    "ml-auto size-4 text-muted-foreground transition-transform",
                    showCompleted ? "" : "-rotate-90",
                  )}
                />
              </button>
              {showCompleted && (
                <Card className="divide-y divide-border overflow-hidden p-0">
                  {completed.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      dim
                      onClick={() => openPanel(t.id, t.projectId)}
                      trailing={
                        t.completedAt ? (
                          <span className="text-xs text-muted-foreground">
                            {t.completedAt.slice(0, 10)}
                          </span>
                        ) : null
                      }
                    />
                  ))}
                </Card>
              )}
            </section>
          )}
        </div>
      )}

      <TaskPanel
        open={panelTaskId !== null}
        taskId={panelTaskId}
        projectId={panelProjectId}
        workspaceSlug={workspaceSlug}
        editable
        canManageLabels={false}
        members={members}
        labels={labels}
        onClose={() => setPanelTaskId(null)}
        onTaskUpdate={handleTaskUpdate}
        onArchive={handleArchive}
        onRefresh={() => {}}
      />
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  iconClass,
  label,
  count,
}: {
  icon: LucideIcon;
  iconClass: string;
  label: string;
  count: number;
}) {
  return (
    <h2 className="flex items-center gap-2 border-b-[3px] border-border pb-2">
      <Icon className={cn("size-4", iconClass)} />
      <span className="font-display text-xs uppercase tracking-widest">{label}</span>
      <span className="font-sans text-xs text-muted-foreground">{count}</span>
    </h2>
  );
}

function TaskRow({
  task,
  trailing,
  dim,
  onClick,
}: {
  task: MyTaskDTO;
  trailing: React.ReactNode;
  dim?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left font-sans text-sm transition-colors hover:bg-muted"
    >
      <span className={cn("min-w-0 flex-1 truncate font-medium", dim && "text-muted-foreground line-through")}>
        {task.title}
      </span>
      <span className="flex shrink-0 items-center gap-2.5">
        {trailing}
        <span className="hidden text-xs text-muted-foreground sm:inline">{task.projectName}</span>
        <StatusBadge status={task.status} />
      </span>
    </button>
  );
}
