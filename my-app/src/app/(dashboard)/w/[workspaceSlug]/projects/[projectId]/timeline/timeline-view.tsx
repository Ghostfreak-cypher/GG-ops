"use client";

import { useState, useMemo, useRef, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { ViewMode } from "gantt-task-react";
import type { Task as GanttTask } from "gantt-task-react";
import "gantt-task-react/dist/index.css";
import { Calendar, ZoomIn, ZoomOut } from "lucide-react";
import type { TaskDTO, BoardSection } from "@/modules/task/server/dto";
import type { DependencyEdge } from "@/modules/task/server/queries/project-dependencies";
import { cn } from "@/lib/utils";

/**
 * gantt-task-react renders its task-name column as `listCellWidth && <TaskList/>`,
 * so passing "" drops the fixed 200px column and gives the bars the whole width —
 * the only way to make this chart usable on a phone without forking the library.
 * useSyncExternalStore rather than state+effect: this component server-renders, so
 * `window` can't be read during the first render.
 */
const NARROW = "(max-width: 767px)";
const subscribeNarrow = (cb: () => void) => {
  const mq = window.matchMedia(NARROW);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/**
 * On touch screens the library is hard to drive: it pans only on `wheel` events and
 * opens tasks only on double-click. So on coarse pointers we translate horizontal
 * swipes into wheel events, open on a single tap, and drop the inner scroll cap so
 * rows scroll with the page.
 */
const COARSE = "(pointer: coarse)";
const subscribeCoarse = (cb: () => void) => {
  const mq = window.matchMedia(COARSE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#3b82f6",
  LOW: "#9ca3af",
};


function taskToGantt(task: TaskDTO, projectName: string, depIds: string[]): GanttTask | null {
  if (!task.dueDate && !task.startDate) return null;

  const isMilestone = task.type === "MILESTONE";

  const end = task.dueDate
    ? new Date(task.dueDate)
    : task.startDate
    ? new Date(task.startDate)
    : new Date();

  // Milestones are a single point — same date for start and end.
  const start = isMilestone
    ? new Date(end)
    : task.startDate
    ? new Date(task.startDate)
    : new Date(end.getTime() - 86400000);

  if (!isMilestone && start >= end) {
    start.setTime(end.getTime() - 86400000);
  }

  return {
    id: task.id,
    name: task.title,
    start,
    end,
    progress: task.status === "DONE" ? 100 : task.status === "IN_PROGRESS" ? 50 : 0,
    type: isMilestone ? "milestone" : "task",
    project: projectName,
    isDisabled: false,
    dependencies: depIds.length > 0 ? depIds : undefined,
    styles: isMilestone
      ? {
          backgroundColor: "#7c3aed",
          backgroundSelectedColor: "#6d28d9",
          progressColor: "rgba(255,255,255,0.4)",
          progressSelectedColor: "rgba(255,255,255,0.4)",
        }
      : {
          backgroundColor: PRIORITY_COLORS[task.priority] ?? "#3b82f6",
          backgroundSelectedColor: PRIORITY_COLORS[task.priority] ?? "#3b82f6",
          progressColor: "rgba(255,255,255,0.4)",
          progressSelectedColor: "rgba(255,255,255,0.4)",
        },
  };
}

// ViewMode is a string enum. Importing it as a value pulled all of gantt-task-react into this
// page's initial bundle and defeated the dynamic() import below, so use its string values.
const DAY = "Day" as ViewMode;
const WEEK = "Week" as ViewMode;
const MONTH = "Month" as ViewMode;
const ZOOM_MODES: ViewMode[] = [DAY, WEEK, MONTH];
const ZOOM_LABELS = ["Day", "Week", "Month"];

// Lazy-load the Gantt component to avoid SSR issues (it references window/document)
const GanttChart = dynamic(
  () => import("gantt-task-react").then((m) => ({ default: m.Gantt })),
  { ssr: false },
);

export function TimelineView({
  workspaceSlug,
  projectId,
  sections,
  tasks,
  dependencies,
}: {
  workspaceSlug: string;
  projectId: string;
  sections: BoardSection[];
  tasks: TaskDTO[];
  dependencies: DependencyEdge[];
}) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>(MONTH);
  const isNarrow = useSyncExternalStore(
    subscribeNarrow,
    () => window.matchMedia(NARROW).matches,
    () => false,
  );
  const isCoarse = useSyncExternalStore(
    subscribeCoarse,
    () => window.matchMedia(COARSE).matches,
    () => false,
  );
  const lastTouch = useRef<{ x: number; y: number } | null>(null);

  // Build a map of fromTaskId → [toTaskId, ...] (the tasks it's blocked by)
  const depMap = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const d of dependencies) {
      const arr = m.get(d.fromTaskId) ?? [];
      arr.push(d.toTaskId);
      m.set(d.fromTaskId, arr);
    }
    return m;
  }, [dependencies]);

  const ganttTasks = useMemo<GanttTask[]>(() => {
    const projectName = sections[0]?.name ?? "Project";
    return tasks
      .map((t) => taskToGantt(t, projectName, depMap.get(t.id) ?? []))
      .filter((t): t is GanttTask => t !== null);
  }, [tasks, sections, depMap]);

  const openTask = (id: string) =>
    router.push(`/w/${workspaceSlug}/projects/${projectId}/tasks/${id}`);

  const tasksWithDates = tasks.filter((t) => t.dueDate || t.startDate);
  const tasksWithoutDates = tasks.filter((t) => !t.dueDate && !t.startDate);

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Calendar className="size-10 text-muted-foreground" />
        <p className="text-sm font-medium">No tasks yet</p>
        <p className="text-xs text-muted-foreground">Create tasks to see them on the timeline.</p>
      </div>
    );
  }

  if (ganttTasks.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Calendar className="size-10 text-muted-foreground" />
          <p className="text-sm font-medium">No tasks have dates</p>
          <p className="text-xs text-muted-foreground">
            Set start dates or due dates on tasks to see them here.
          </p>
        </div>
        {tasksWithoutDates.length > 0 && (
          <NoDatesSection
            tasks={tasksWithoutDates}
            workspaceSlug={workspaceSlug}
            projectId={projectId}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Zoom controls */}
      <div className="flex flex-wrap items-center gap-2">
        <ZoomOut className="size-4 text-muted-foreground" />
        <div className="flex rounded-md border border-border overflow-hidden">
          {ZOOM_MODES.map((mode, i) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={cn(
                "px-3 py-1.5 pointer-coarse:min-h-10 text-xs font-medium transition-colors border-r border-border last:border-r-0",
                viewMode === mode
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {ZOOM_LABELS[i]}
            </button>
          ))}
        </div>
        <ZoomIn className="size-4 text-muted-foreground" />
        <span className="ml-2 text-xs text-muted-foreground">
          {tasksWithDates.length} of {tasks.length} tasks have dates
        </span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span>Priority:</span>
        {Object.entries(PRIORITY_COLORS).map(([p, c]) => (
          <span key={p} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ backgroundColor: c }} />
            {p.charAt(0) + p.slice(1).toLowerCase()}
          </span>
        ))}
        <span className="ml-2 flex items-center gap-1.5">
          <span className="inline-block size-2.5 rotate-45 rounded-sm bg-violet-600" />
          Milestone
        </span>
      </div>

      {/* Gantt chart */}
      {/* touch-pan-y on every descendant: the browser keeps vertical page scrolling and
          hands horizontal swipes to the shim below. */}
      <div
        className="overflow-hidden rounded-xl border border-border bg-card touch-pan-y [&_*]:touch-pan-y"
        onTouchStart={(e) => {
          const t = e.touches[0];
          lastTouch.current = { x: t.clientX, y: t.clientY };
        }}
        onTouchMove={(e) => {
          const t = e.touches[0];
          const last = lastTouch.current;
          if (!last) return;
          const dx = last.x - t.clientX;
          const dy = last.y - t.clientY;
          lastTouch.current = { x: t.clientX, y: t.clientY };
          if (Math.abs(dx) > Math.abs(dy)) {
            e.target.dispatchEvent(new WheelEvent("wheel", { deltaX: dx, bubbles: true, cancelable: true }));
          }
        }}
      >
        {ganttTasks.length > 0 && (
          <GanttChart
            tasks={ganttTasks}
            viewMode={viewMode}
            onDoubleClick={(task) => openTask(task.id)}
            onClick={isCoarse ? (task) => openTask(task.id) : undefined}
            listCellWidth={isNarrow ? "" : "200px"}
            columnWidth={viewMode === DAY ? 40 : viewMode === WEEK ? 60 : 120}
            barFill={75}
            ganttHeight={isCoarse ? undefined : Math.min(ganttTasks.length * 50 + 50, 600)}
            todayColor="rgba(239, 68, 68, 0.1)"
          />
        )}
      </div>

      {/* Tasks without dates */}
      {tasksWithoutDates.length > 0 && (
        <NoDatesSection
          tasks={tasksWithoutDates}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
        />
      )}
    </div>
  );
}

function NoDatesSection({
  tasks,
  workspaceSlug,
  projectId,
}: {
  tasks: TaskDTO[];
  workspaceSlug: string;
  projectId: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="font-mono uppercase tracking-widest">
          {expanded ? "▾" : "▸"} No dates ({tasks.length})
        </span>
      </button>
      {expanded && (
        <div className="overflow-hidden rounded-xl border border-border divide-y divide-border">
          {tasks.map((t) => (
            <a
              key={t.id}
              href={`/w/${workspaceSlug}/projects/${projectId}/tasks/${t.id}`}
              className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors"
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: PRIORITY_COLORS[t.priority] ?? "#9ca3af" }}
              />
              <span className="flex-1 truncate">{t.title}</span>
              <span className="text-xs text-muted-foreground font-mono">No date</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
