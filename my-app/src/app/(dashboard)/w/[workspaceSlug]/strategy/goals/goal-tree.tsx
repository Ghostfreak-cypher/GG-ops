"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, ChevronDown, Plus, Search, X, FolderKanban, ListTodo } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  updateGoalAction,
  linkGoalProjectAction,
  unlinkGoalProjectAction,
  linkGoalTaskAction,
  unlinkGoalTaskAction,
} from "@/modules/goal/server/actions/update-goal";
import { searchWorkspaceTasksForPickerAction } from "@/modules/task/server/actions/search-tasks-for-picker";
import { GOAL_STATUS_UI, GOAL_STATUSES } from "@/modules/goal/constants";
import type { GoalDTO } from "@/modules/goal/server/dto";
import type { ProjectSummary } from "@/modules/project/server/queries";
import { CreateGoalModal } from "./create-goal-modal";
import { cn } from "@/lib/utils";

/**
 * Shared grid template for the goal tree, mirroring TASK_GRID in task-row.tsx.
 * Below md only Name and Status survive — Status stays because tapping it is how
 * you cycle a goal's status. Progress and Team are `hidden md:*` so they drop out
 * of grid auto-placement rather than collapsing the tracks.
 */
const GOAL_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_140px_160px_100px]";

/**
 * Depth indent. The old code wrote `paddingLeft` inline, which no Tailwind variant
 * can reach and which grew without bound — a deep tree pushed rows off-screen.
 * Passing the depth as a CSS variable keeps the step in the class, so it can be
 * smaller on phones, and Math.min caps runaway nesting.
 */
const INDENT_PL = "pl-[calc(1rem+var(--depth)*12px)] md:pl-[calc(1rem+var(--depth)*24px)]";

const indentVar = (depth: number) =>
  ({ "--depth": Math.min(depth, 3) }) as React.CSSProperties;

interface GoalTreeProps {
  goals: GoalDTO[];
  workspaceSlug: string;
  projects: ProjectSummary[];
}

type PickerTask = {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
};

export function GoalTree({ goals, workspaceSlug, projects }: GoalTreeProps) {
  const [createOpen, setCreateOpen] = React.useState(false);
  const [defaultParent, setDefaultParent] = React.useState<string | null>(null);

  function openCreate(parentId?: string) {
    setDefaultParent(parentId ?? null);
    setCreateOpen(true);
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className={cn(GOAL_GRID, "gap-2 border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-medium text-muted-foreground")}>
          <span>Name</span>
          <span>Status</span>
          <span className="hidden md:block">Progress</span>
          <span className="hidden md:block">Team</span>
        </div>

        <div className="divide-y divide-border/50">
          {goals.map((g) => (
            <GoalRow
              key={g.id}
              goal={g}
              depth={0}
              workspaceSlug={workspaceSlug}
              projects={projects}
              onAddChild={openCreate}
            />
          ))}
        </div>

        <div className="border-t border-border/50 px-4 py-2">
          <button
            type="button"
            onClick={() => openCreate()}
            className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <Plus className="size-3.5" />
            Add goal
          </button>
        </div>
      </div>

      <CreateGoalModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        workspaceSlug={workspaceSlug}
        goals={goals}
        defaultParentId={defaultParent}
      />
    </>
  );
}

function GoalRow({
  goal,
  depth,
  workspaceSlug,
  projects,
  onAddChild,
}: {
  goal: GoalDTO;
  depth: number;
  workspaceSlug: string;
  projects: ProjectSummary[];
  onAddChild: (parentId: string) => void;
}) {
  const [expanded, setExpanded] = React.useState(true);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [title, setTitle] = React.useState(goal.title);
  const [pending, start] = useTransition();
  const hasChildren = goal.children.length > 0;
  const ui = GOAL_STATUS_UI[goal.status];

  function saveTitle() {
    const t = title.trim();
    if (!t || t === goal.title) {
      setTitle(goal.title);
      setEditing(false);
      return;
    }
    start(async () => {
      const res = await updateGoalAction(workspaceSlug, goal.id, { title: t });
      if (!res.ok) toast.error(res.error ?? "Failed to update");
      setEditing(false);
    });
  }

  function cycleStatus() {
    const idx = GOAL_STATUSES.indexOf(goal.status);
    const next = GOAL_STATUSES[(idx + 1) % GOAL_STATUSES.length];
    start(async () => {
      const res = await updateGoalAction(workspaceSlug, goal.id, { status: next });
      if (!res.ok) toast.error(res.error ?? "Failed to update");
    });
  }

  return (
    <>
      <div
        className={cn(
          GOAL_GRID,
          "group items-center gap-2 py-2.5 pr-4 transition-colors hover:bg-accent/30",
          INDENT_PL,
        )}
        style={indentVar(depth)}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              !hasChildren && "invisible",
            )}
          >
            {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>

          {editing ? (
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveTitle();
                if (e.key === "Escape") {
                  setTitle(goal.title);
                  setEditing(false);
                }
              }}
              className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
            />
          ) : (
            <button
              type="button"
              className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:text-primary"
              onClick={() => setDetailsOpen((v) => !v)}
              onDoubleClick={() => setEditing(true)}
            >
              {goal.title}
            </button>
          )}

          <button
            type="button"
            onClick={() => onAddChild(goal.id)}
            className="invisible shrink-0 text-muted-foreground hover:text-foreground group-hover:visible pointer-coarse:visible"
            title="Add sub-goal"
          >
            <Plus className="size-3.5" />
          </button>
        </div>

        <div>
          <button
            type="button"
            onClick={cycleStatus}
            disabled={pending}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80",
              ui.badge,
            )}
          >
            <span className={cn("size-1.5 rounded-full", ui.dot)} />
            {ui.label}
          </button>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all", ui.bar)}
              style={{ width: `${goal.progress}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
            {goal.progress}%
          </span>
        </div>

        <span className="hidden truncate text-xs text-muted-foreground md:block">
          {goal.teamLabel ?? "—"}
        </span>
      </div>

      {detailsOpen && (
        <div
          className={cn(
            "border-t border-border/50 bg-muted/20 py-3 pr-4",
            "pl-[calc(2.25rem+var(--depth)*12px)] md:pl-[calc(2.25rem+var(--depth)*24px)]",
          )}
          style={indentVar(depth)}
        >
          <GoalLinksEditor goal={goal} workspaceSlug={workspaceSlug} projects={projects} />
        </div>
      )}

      {expanded && goal.children.map((child) => (
        <GoalRow
          key={child.id}
          goal={child}
          depth={depth + 1}
          workspaceSlug={workspaceSlug}
          projects={projects}
          onAddChild={onAddChild}
        />
      ))}
    </>
  );
}

function GoalLinksEditor({
  goal,
  workspaceSlug,
  projects,
}: {
  goal: GoalDTO;
  workspaceSlug: string;
  projects: ProjectSummary[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selectedProjectId, setSelectedProjectId] = React.useState("");
  const [taskQuery, setTaskQuery] = React.useState("");
  const [taskResults, setTaskResults] = React.useState<PickerTask[]>([]);
  const [searchingTasks, setSearchingTasks] = React.useState(false);

  const availableProjects = projects.filter(
    (project) => !goal.linkedProjects.some((linkedProject) => linkedProject.id === project.id),
  );

  async function searchTasks(query: string) {
    setTaskQuery(query);
    if (!query.trim()) {
      setTaskResults([]);
      return;
    }

    setSearchingTasks(true);
    try {
      const results = await searchWorkspaceTasksForPickerAction(
        workspaceSlug,
        query,
        selectedProjectId || undefined,
      );
      const linkedTaskIds = new Set(goal.linkedTasks.map((task) => task.id));
      setTaskResults(results.filter((task) => !linkedTaskIds.has(task.id)));
    } finally {
      setSearchingTasks(false);
    }
  }

  function addProject(projectId: string) {
    start(async () => {
      const res = await linkGoalProjectAction(workspaceSlug, goal.id, projectId);
      if (!res.ok) {
        toast.error(res.error ?? "Failed to link project");
        return;
      }
      setSelectedProjectId("");
      router.refresh();
    });
  }

  function removeProject(projectId: string) {
    start(async () => {
      const res = await unlinkGoalProjectAction(workspaceSlug, goal.id, projectId);
      if (!res.ok) {
        toast.error(res.error ?? "Failed to unlink project");
        return;
      }
      router.refresh();
    });
  }

  function addTask(taskId: string) {
    start(async () => {
      const res = await linkGoalTaskAction(workspaceSlug, goal.id, taskId);
      if (!res.ok) {
        toast.error(res.error ?? "Failed to link task");
        return;
      }
      setTaskQuery("");
      setTaskResults([]);
      router.refresh();
    });
  }

  function removeTask(taskId: string) {
    start(async () => {
      const res = await unlinkGoalTaskAction(workspaceSlug, goal.id, taskId);
      if (!res.ok) {
        toast.error(res.error ?? "Failed to unlink task");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <FolderKanban className="size-4 text-muted-foreground" />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Linked projects</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {goal.linkedProjects.length > 0 ? (
            goal.linkedProjects.map((project) => (
              <div key={project.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs">
                <Link href={`/w/${workspaceSlug}/projects/${project.id}`} className="hover:text-primary">
                  {project.name}
                </Link>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => removeProject(project.id)}
                  className="text-muted-foreground transition-colors hover:text-destructive"
                  aria-label={`Unlink ${project.name}`}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">No linked projects.</p>
          )}
        </div>
        {availableProjects.length > 0 && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Select a project</option>
              {availableProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!selectedProjectId || pending}
              onClick={() => addProject(selectedProjectId)}
              className="inline-flex h-9 items-center justify-center rounded-md border border-input px-3 text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              Link project
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <ListTodo className="size-4 text-muted-foreground" />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Linked tasks</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {goal.linkedTasks.length > 0 ? (
            goal.linkedTasks.map((task) => (
              <div key={task.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs">
                <Link href={`/w/${workspaceSlug}/projects/${task.projectId}/tasks/${task.id}`} className="hover:text-primary">
                  {task.title}
                </Link>
                <span className="text-muted-foreground">{task.projectName}</span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => removeTask(task.id)}
                  className="text-muted-foreground transition-colors hover:text-destructive"
                  aria-label={`Unlink ${task.title}`}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">No linked tasks.</p>
          )}
        </div>

        <div className="space-y-2 rounded-xl border border-border bg-background p-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                if (taskQuery.trim()) {
                  void searchTasks(taskQuery);
                }
              }}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm sm:w-52"
            >
              <option value="">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={taskQuery}
                onChange={(e) => void searchTasks(e.target.value)}
                placeholder="Search tasks to link..."
                className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          {searchingTasks && <p className="text-xs text-muted-foreground">Searching tasks...</p>}
          {!searchingTasks && taskQuery.trim() && taskResults.length === 0 && (
            <p className="text-xs text-muted-foreground">No tasks found.</p>
          )}
          {!searchingTasks && taskResults.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-border">
              {taskResults.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => addTask(task.id)}
                  className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left text-sm transition-colors last:border-b-0 hover:bg-accent"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{task.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{task.projectName}</p>
                  </div>
                  <Plus className="size-3.5 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
