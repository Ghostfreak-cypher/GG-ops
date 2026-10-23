"use client";

import * as React from "react";
import Link from "next/link";
import { List, LayoutGrid, GanttChartSquare, Settings2, Users, ChevronDown, ChevronUp, Plus } from "lucide-react";
import type { BoardData } from "@/modules/task/server/dto";
import type { TaskDTO } from "@/modules/task/server/dto";
import { STATUS_UI } from "@/lib/task-ui";
import { cn } from "@/lib/utils";
import { ProjectStatusPicker } from "./project-status-picker";

const STATUS_KEYS = ["TODO", "IN_PROGRESS", "DONE", "BLOCKED"] as const;

function getProjectAccent(color: string | null): string {
  if (color) return color;
  return "#4f46e5";
}

function ProjectColorChip({ color, icon }: { color: string | null; icon: string | null }) {
  const accent = getProjectAccent(color);
  return (
    <div
      className="flex size-10 shrink-0 items-center justify-center rounded-xl text-xl text-white shadow-sm"
      style={{ backgroundColor: accent }}
    >
      {icon ?? "📋"}
    </div>
  );
}

function ProgressBar({ tasks }: { tasks: TaskDTO[] }) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "DONE").length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium tabular-nums text-muted-foreground">
        {pct}%
      </span>
    </div>
  );
}

function StatusCounts({ tasks }: { tasks: TaskDTO[] }) {
  const counts = STATUS_KEYS.map((s) => ({
    key: s,
    label: STATUS_UI[s].label,
    dot: STATUS_UI[s].dot,
    count: tasks.filter((t) => t.status === s).length,
  }));

  return (
    <div className="flex flex-wrap items-center gap-3">
      {counts.map(({ key, label, dot, count }) => (
        <span key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={cn("size-2 rounded-full", dot)} />
          <span className="tabular-nums font-medium text-foreground">{count}</span>
          {label}
        </span>
      ))}
    </div>
  );
}

interface ProjectHeaderProps {
  board: BoardData;
  allTasks: TaskDTO[];
  workspaceSlug: string;
  projectId: string;
  viewMode: "list" | "board" | "timeline" | "settings";
  editable?: boolean;
  canManage?: boolean;
  onNewTask?: () => void;
}

export function ProjectHeader({
  board,
  allTasks,
  workspaceSlug,
  projectId,
  viewMode,
  editable = false,
  canManage = false,
  onNewTask,
}: ProjectHeaderProps) {
  const [descExpanded, setDescExpanded] = React.useState(false);
  const hasDesc = !!board.projectDescription;

  const listHref = `/w/${workspaceSlug}/projects/${projectId}`;
  const boardHref = `/w/${workspaceSlug}/projects/${projectId}/board`;
  const timelineHref = `/w/${workspaceSlug}/projects/${projectId}/timeline`;
  const settingsHref = `/w/${workspaceSlug}/projects/${projectId}/settings`;

  return (
    <div className="space-y-4 pb-4">
      {/* Top row */}
      <div className="flex flex-wrap items-start gap-3">
        <ProjectColorChip color={board.projectColor} icon={board.projectIcon} />

        <div className="min-w-48 flex-1 space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="min-w-0 truncate text-xl font-bold tracking-tight">
              {board.projectName}
            </h1>
            {hasDesc && (
              <button
                type="button"
                className="text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setDescExpanded((v) => !v)}
                aria-label={descExpanded ? "Collapse description" : "Expand description"}
              >
                {descExpanded ? (
                  <ChevronUp className="size-4" />
                ) : (
                  <ChevronDown className="size-4" />
                )}
              </button>
            )}
            <ProjectStatusPicker
              slug={workspaceSlug}
              projectId={projectId}
              statusColor={board.projectStatusColor}
              canEdit={canManage}
            />
          </div>

          {hasDesc && descExpanded && (
            <p className="max-w-2xl text-sm text-muted-foreground leading-relaxed">
              {board.projectDescription}
            </p>
          )}

          {/* Progress + member count row */}
          <div className="flex flex-wrap items-center gap-4 pt-0.5">
            <div className="w-48">
              <ProgressBar tasks={allTasks} />
            </div>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="size-3.5" />
              {board.memberCount} {board.memberCount === 1 ? "member" : "members"}
            </span>
          </div>
        </div>

        {/* New task CTA */}
        {editable && onNewTask && (
          <button
            type="button"
            onClick={onNewTask}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 pointer-coarse:min-h-11 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 active:scale-[0.98]"
          >
            <Plus className="size-4" />
            New task
          </button>
        )}

        {/* View switcher */}
        <div className="inline-flex shrink-0 items-center rounded-lg border border-border bg-card p-0.5 text-sm shadow-sm">
          <Link
            href={listHref}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors pointer-coarse:min-h-10 pointer-coarse:min-w-10 pointer-coarse:justify-center",
              viewMode === "list"
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <List className="size-3.5" />
            <span className="sr-only sm:not-sr-only">List</span>
          </Link>
          <Link
            href={boardHref}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors pointer-coarse:min-h-10 pointer-coarse:min-w-10 pointer-coarse:justify-center",
              viewMode === "board"
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <LayoutGrid className="size-3.5" />
            <span className="sr-only sm:not-sr-only">Board</span>
          </Link>
          <Link
            href={timelineHref}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors pointer-coarse:min-h-10 pointer-coarse:min-w-10 pointer-coarse:justify-center",
              viewMode === "timeline"
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <GanttChartSquare className="size-3.5" />
            <span className="sr-only sm:not-sr-only">Timeline</span>
          </Link>
          {canManage && (
            <Link
              href={settingsHref}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors pointer-coarse:min-h-10 pointer-coarse:min-w-10 pointer-coarse:justify-center",
                viewMode === "settings"
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Settings2 className="size-3.5" />
              <span className="sr-only sm:not-sr-only">Settings</span>
            </Link>
          )}
        </div>
      </div>

      {/* Status counts */}
      {allTasks.length > 0 && <StatusCounts tasks={allTasks} />}
    </div>
  );
}
