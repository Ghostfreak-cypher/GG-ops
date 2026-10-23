"use client";

import * as React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { format } from "date-fns";
import {
  X,
  ExternalLink,
  AlignLeft,
  CalendarDays,
  Tag,
  User2,
  Flag,
  ListChecks,
  Plus,
  Trash2,
  ChevronRight,
} from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { fetchTaskDetailAction } from "@/modules/task/server/actions/fetch-task-detail";
import { updateTaskAction } from "@/modules/task/server/actions/update-task";
import { archiveTaskAction } from "@/modules/task/server/actions/archive-task";
import { createTaskAction } from "@/modules/task/server/actions/create-task";
import { TASK_TYPES } from "@/modules/task/constants";
import type { TaskDetailDTO, TaskDTO } from "@/modules/task/server/dto";
import type { TaskType } from "@/modules/task/constants";
import { StatusPopover } from "@/components/task/status-popover";
import { PriorityPopover } from "@/components/task/priority-popover";
import { AssigneePopover } from "@/components/task/assignee-popover";
import { LabelPopover } from "@/components/task/label-popover";
import { DueDatePopover } from "@/components/task/due-date-popover";
import { AvatarStack } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { STATUS_UI, PRIORITY_UI, TYPE_UI } from "@/lib/task-ui";
import { cn } from "@/lib/utils";
import { RichCommentBox } from "@/components/task/rich-comment-box";
import { TaskDescriptionAttachments } from "@/components/task/task-description-attachments";
import { RichTextContent } from "@/components/ui/rich-text-content";

// The panel only ever mounts this once a task is open (taskId !== null, see the exported
// `TaskPanel` below), and `TaskPanelContent` already shows a skeleton while it fetches the
// task detail — so lazy-loading the tiptap/ProseMirror/emoji-picker stack behind that
// existing loading state is invisible. `ssr:false` is safe: this subtree never exists in
// the server-rendered HTML anyway (taskId is null on first paint), and tiptap needs a DOM.
const RichTextEditor = dynamic(
  () => import("@/components/ui/rich-text-editor").then((m) => m.RichTextEditor),
  {
    ssr: false,
    loading: () => <div className="min-h-30 rounded-xl border border-border" />,
  },
);
import { SaveStatus, type SaveState } from "@/components/ui/save-status";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";

/** `email` feeds @mention search in the comment box; optional so pass-through callers still compile. */
type Member = { id: string; name: string; email?: string | null; image?: string | null };
type LabelOpt = { id: string; name: string; color: string | null };

export interface TaskPanelProps {
  open: boolean;
  taskId: string | null;
  projectId: string;
  workspaceSlug: string;
  editable: boolean;
  canManageLabels: boolean;
  members: Member[];
  labels: LabelOpt[];
  onClose: () => void;
  onTaskUpdate: (taskId: string, patch: Partial<TaskDTO>) => void;
  onArchive: (taskId: string) => void;
  onRefresh: () => void;
}

// ─── Loading skeleton ────────────────────────────────────────────────────────

function PanelSkeleton() {
  return (
    <div className="space-y-5 p-5">
      <Skeleton className="h-7 w-3/4 rounded-lg" />
      <div className="space-y-0 rounded-xl border border-border overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
            <Skeleton className="h-3.5 w-20 rounded" />
            <Skeleton className="h-6 w-24 rounded-md" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-24 rounded" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    </div>
  );
}

// ─── Details field row ───────────────────────────────────────────────────────

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <div className="flex w-24 shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

// ─── Panel body — all the editable content ───────────────────────────────────

function PanelBody({
  task: initial,
  projectId,
  workspaceSlug,
  editable,
  canManageLabels,
  members,
  labels,
  onTaskUpdate,
  onArchive,
  onRefresh,
  onClose,
}: {
  task: TaskDetailDTO;
  projectId: string;
  workspaceSlug: string;
  editable: boolean;
  canManageLabels: boolean;
  members: Member[];
  labels: LabelOpt[];
  onTaskUpdate: (taskId: string, patch: Partial<TaskDTO>) => void;
  onArchive: (taskId: string) => void;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const [task, setTask] = React.useState(initial);
  const [title, setTitle] = React.useState(initial.title);
  const [description, setDescription] = React.useState(initial.description ?? "");
  const [newSubtask, setNewSubtask] = React.useState("");
  const [pending, start] = useTransition();

  // Optimistically update the panel's local state, sync the parent list/board,
  // then persist. Roll back on failure.
  function update(
    apiPatch: Record<string, unknown>,
    panelPatch: Partial<TaskDetailDTO>,
    parentPatch: Partial<TaskDTO> = panelPatch as Partial<TaskDTO>,
  ) {
    const snapshot = task;
    setTask((prev) => ({ ...prev, ...panelPatch } as TaskDetailDTO));
    onTaskUpdate(task.id, parentPatch);
    start(async () => {
      const res = await updateTaskAction(task.id, apiPatch);
      if (!res.ok) {
        toast.error(res.error ?? "Failed to save");
        setTask(snapshot);
        onTaskUpdate(task.id, snapshot as unknown as Partial<TaskDTO>);
      }
    });
  }

  // Debounced description autosave with a live "Saving…/Saved" indicator.
  const [descSave, setDescSave] = React.useState<SaveState>("idle");
  const savedTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Plain async (not a transition) so background autosaves never disable the editor.
  async function persistDescription(html: string) {
    if (html === (task.description ?? "")) return;
    setDescSave("saving");
    const res = await updateTaskAction(task.id, { description: html });
    if (!res.ok) {
      setDescSave("error");
      toast.error(res.error ?? "Failed to save");
      return;
    }
    setTask((prev) => ({ ...prev, description: html || null }) as TaskDetailDTO);
    onTaskUpdate(task.id, { description: html || null } as Partial<TaskDTO>);
    setDescSave("saved");
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setDescSave("idle"), 2000);
  }

  const { debounced: debouncedSaveDescription, flush: flushDescription } = useDebouncedCallback(
    persistDescription,
    700,
  );

  const statusUi = STATUS_UI[task.status];
  const priorityUi = PRIORITY_UI[task.priority];

  return (
    <div className="pb-20">
      {/* Title */}
      <div className="px-5 pt-5 pb-4">
        {editable ? (
          <input
            className={cn(
              "w-full bg-transparent text-xl font-bold tracking-tight outline-none",
              "rounded-md px-1 -mx-1 transition-colors",
              "hover:bg-muted/40 focus:bg-muted/40 focus:ring-1 focus:ring-ring",
              pending && "opacity-60",
            )}
            value={title}
            disabled={pending}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              const t = title.trim();
              if (t && t !== task.title) {
                update({ title: t }, { title: t }, { title: t });
              } else {
                setTitle(task.title);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        ) : (
          <h2 className="text-xl font-bold tracking-tight">{task.title}</h2>
        )}
      </div>

      {/* ── Details grid ─────────────────────────────────────── */}
      <div className="mx-5 mb-5 rounded-xl border border-border bg-card overflow-hidden">
        <div className="divide-y divide-border">

          {/* Status */}
          <Field
            label="Status"
            icon={<span className={cn("size-2 rounded-full", statusUi.dot)} />}
          >
            <StatusPopover
              value={task.status}
              disabled={!editable || pending}
              onSelect={(status) =>
                update({ status }, { status }, { status })
              }
            >
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-opacity hover:opacity-80",
                  statusUi.badge,
                )}
              >
                {statusUi.label}
              </button>
            </StatusPopover>
          </Field>

          {/* Priority */}
          <Field
            label="Priority"
            icon={<span className={cn("size-2 rounded-full", priorityUi.dot)} />}
          >
            <PriorityPopover
              value={task.priority}
              disabled={!editable || pending}
              onSelect={(priority) =>
                update({ priority }, { priority }, { priority })
              }
            >
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-opacity hover:opacity-80",
                  priorityUi.badge,
                )}
              >
                {priorityUi.label}
              </button>
            </PriorityPopover>
          </Field>

          {/* Type */}
          <Field label="Type" icon={<Flag className="size-3.5" />}>
            {editable ? (
              <select
                value={task.type}
                disabled={pending}
                onChange={(e) => {
                  const type = e.target.value as TaskType;
                  update({ type }, { type });
                }}
                className="cursor-pointer appearance-none rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground outline-none transition-colors hover:bg-muted"
              >
                {TASK_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_UI[t].label}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-muted-foreground">
                {TYPE_UI[task.type].label}
              </span>
            )}
          </Field>

          {/* Due date */}
          <Field label="Due date" icon={<CalendarDays className="size-3.5" />}>
            <DueDatePopover
              value={task.dueDate}
              disabled={!editable || pending}
              onSelect={(dueDate) =>
                update({ dueDate }, { dueDate }, { dueDate })
              }
            >
              <button
                type="button"
                className="text-xs transition-colors hover:text-primary"
              >
                {task.dueDate ? (
                  format(new Date(task.dueDate), "MMM d, yyyy")
                ) : (
                  <span className="text-muted-foreground">Not set</span>
                )}
              </button>
            </DueDatePopover>
          </Field>

          {/* Assignees */}
          <Field label="Assignees" icon={<User2 className="size-3.5" />}>
            <AssigneePopover
              value={task.assignees.map((a) => a.id)}
              members={members}
              disabled={!editable || pending}
              onSelect={(assigneeIds) => {
                const assignees = members
                  .filter((m) => assigneeIds.includes(m.id))
                  .map((m) => ({ id: m.id, name: m.name, image: m.image ?? null }));
                update({ assigneeIds }, { assignees }, { assignees });
              }}
            >
              <button type="button" className="flex flex-wrap items-center gap-1.5">
                {task.assignees.length > 0 ? (
                  <>
                    <AvatarStack people={task.assignees} size="xs" />
                    <span className="text-xs text-muted-foreground">
                      {task.assignees.map((a) => a.name).join(", ")}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground transition-colors hover:text-foreground">
                    Unassigned
                  </span>
                )}
              </button>
            </AssigneePopover>
          </Field>

          {/* Labels */}
          <Field label="Labels" icon={<Tag className="size-3.5" />}>
            <div className="flex flex-wrap items-center gap-1.5">
              {task.labels.map((l) => (
                <span
                  key={l.id}
                  className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground"
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: l.color ?? "var(--muted-foreground)" }}
                  />
                  {l.name}
                </span>
              ))}
              <LabelPopover
                value={task.labels.map((l) => l.id)}
                labels={labels}
                disabled={!editable || pending}
                workspaceSlug={workspaceSlug}
                canManage={canManageLabels}
                onSelect={(labelIds) => {
                  const resolved = labels
                    .filter((l) => labelIds.includes(l.id))
                    .map((l) => ({ id: l.id, name: l.name, color: l.color }));
                  update(
                    { labelIds },
                    { labels: resolved, labelIds },
                    { labelIds },
                  );
                }}
              >
                <button
                  type="button"
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  {task.labels.length === 0 ? "Add labels" : "Edit"}
                </button>
              </LabelPopover>
            </div>
          </Field>

          {/* Parent task link */}
          {task.parentTaskId && (
            <Field label="Parent" icon={<ChevronRight className="size-3.5" />}>
              <Link
                href={`/w/${workspaceSlug}/projects/${projectId}/tasks/${task.parentTaskId}`}
                className="text-xs text-primary transition-colors hover:underline"
                onClick={onClose}
              >
                View parent task
              </Link>
            </Field>
          )}
        </div>
      </div>

      {/* ── Description ──────────────────────────────────────── */}
      <div className="mx-5 mb-5">
        <div className="mb-2 flex items-center gap-1.5">
          <AlignLeft className="size-3.5 text-muted-foreground" />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Description
          </p>
          <SaveStatus state={descSave} className="ml-auto" />
        </div>
        {editable ? (
          <RichTextEditor
            value={description}
            onChange={(html) => {
              setDescription(html);
              debouncedSaveDescription(html);
            }}
            onBlur={flushDescription}
            placeholder="Add a description…"
          />
        ) : (
          <div className="rounded-xl bg-muted/40 p-3 text-sm leading-relaxed">
            <RichTextContent html={task.description} emptyText="No description" />
          </div>
        )}

        <TaskDescriptionAttachments taskId={task.id} editable={editable} />
      </div>

      {/* ── Subtasks ─────────────────────────────────────────── */}
      <div className="mx-5 mb-5">
        <div className="mb-2 flex items-center gap-2">
          <ListChecks className="size-3.5 text-muted-foreground" />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Subtasks
          </p>
          {task.subtasks.length > 0 && (
            <Badge variant="secondary" className="px-1.5 py-0 text-xs">
              {task.subtasks.length}
            </Badge>
          )}
        </div>

        <div className="rounded-xl border border-border overflow-hidden">
          {task.subtasks.length === 0 ? (
            <p className="px-4 py-3 text-xs text-muted-foreground">No subtasks yet</p>
          ) : (
            task.subtasks.map((s) => (
              <Link
                key={s.id}
                href={`/w/${workspaceSlug}/projects/${projectId}/tasks/${s.id}`}
                onClick={onClose}
                className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0 transition-colors hover:bg-muted"
              >
                <span className={cn("size-2 shrink-0 rounded-full", STATUS_UI[s.status].dot)} />
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-sm",
                    s.status === "DONE" && "text-muted-foreground line-through",
                  )}
                >
                  {s.title}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-md px-1.5 py-0.5 text-xs",
                    STATUS_UI[s.status].badge,
                  )}
                >
                  {STATUS_UI[s.status].label}
                </span>
              </Link>
            ))
          )}
        </div>

        {editable && (
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const t = newSubtask.trim();
              if (!t) return;
              start(async () => {
                const res = await createTaskAction(projectId, {
                  title: t,
                  parentTaskId: task.id,
                });
                if (!res.ok) {
                  toast.error(res.error ?? "Failed to create subtask");
                  return;
                }
                setNewSubtask("");
                // Re-fetch this task to show the new subtask
                const updated = await fetchTaskDetailAction(task.id);
                if (updated.ok && updated.data) setTask(updated.data);
                onRefresh();
              });
            }}
          >
            <Input
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              placeholder="Add subtask…"
              className="h-8 text-sm"
              disabled={pending}
            />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={pending || !newSubtask.trim()}
              className="shrink-0"
            >
              <Plus className="size-3.5" />
            </Button>
          </form>
        )}
      </div>

      {/* ── Activity / Comments ───────────────────────────────── */}
      <div className="mx-5 mb-5 min-h-[30vh]">
        <RichCommentBox taskId={task.id} editable={editable} members={members} />
      </div>

      {/* ── Archive ───────────────────────────────────────────── */}
      {editable && (
        <div className="mx-5 border-t border-border pt-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await archiveTaskAction(task.id);
                if (!res.ok) {
                  toast.error(res.error ?? "Failed to archive");
                  return;
                }
                onArchive(task.id);
                onClose();
              })
            }
          >
            <Trash2 className="size-4" />
            Archive task
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Inner panel content — mounts fresh per task via key={taskId} ────────────

function TaskPanelContent({
  taskId,
  projectId,
  workspaceSlug,
  editable,
  canManageLabels,
  members,
  labels,
  onClose,
  onTaskUpdate,
  onArchive,
  onRefresh,
}: {
  taskId: string;
  projectId: string;
  workspaceSlug: string;
  editable: boolean;
  canManageLabels: boolean;
  members: Member[];
  labels: LabelOpt[];
  onClose: () => void;
  onTaskUpdate: (taskId: string, patch: Partial<TaskDTO>) => void;
  onArchive: (taskId: string) => void;
  onRefresh: () => void;
}) {
  // Initialize loading=true and taskDetail=null so the effect never calls
  // setState synchronously — all setState happens inside the async .then().
  const [taskDetail, setTaskDetail] = React.useState<TaskDetailDTO | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // Warm the lazy editor chunk alongside the detail fetch rather than after it: same
    // specifier as the `dynamic()` above, so it's the same module-cache entry, and this
    // same-origin chunk fetch reliably resolves before the server round trip does — so
    // the editor's `loading` fallback above is never actually reached.
    void import("@/components/ui/rich-text-editor");
    fetchTaskDetailAction(taskId).then((res) => {
      if (res.ok && res.data) setTaskDetail(res.data);
      else if (!res.ok) toast.error(res.error);
      setLoading(false);
    });
  }, [taskId]);

  return (
    <>
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <span className="text-xs font-medium text-muted-foreground">Task details</span>
        <div className="flex items-center gap-1">
          {taskDetail && (
            <Link
              href={`/w/${workspaceSlug}/projects/${projectId}/tasks/${taskDetail.id}`}
              className="flex size-8 pointer-coarse:size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Open full page"
              aria-label="Open task in full page"
            >
              <ExternalLink className="size-4" />
            </Link>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 pointer-coarse:size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close panel"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {loading ? (
          <PanelSkeleton />
        ) : taskDetail ? (
          <PanelBody
            key={taskDetail.id}
            task={taskDetail}
            projectId={projectId}
            workspaceSlug={workspaceSlug}
            editable={editable}
            canManageLabels={canManageLabels}
            members={members}
            labels={labels}
            onTaskUpdate={onTaskUpdate}
            onArchive={onArchive}
            onRefresh={onRefresh}
            onClose={onClose}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
            Task not found
          </div>
        )}
      </div>
    </>
  );
}

// ─── Main exported panel ─────────────────────────────────────────────────────

export function TaskPanel({
  open,
  taskId,
  projectId,
  workspaceSlug,
  editable,
  canManageLabels,
  members,
  labels,
  onClose,
  onTaskUpdate,
  onArchive,
  onRefresh,
}: TaskPanelProps) {
  // Sheet (Radix Dialog) supplies Escape, the scrim, focus trap, focus restore and
  // body-scroll lock. It also unmounts on close — the panel used to stay in the DOM
  // with role="dialog", so keyboard users could tab into an invisible drawer.
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent side="right" title="Task details">
        {taskId ? (
          // key forces a fresh mount (and state reset) when switching tasks
          <TaskPanelContent
            key={taskId}
            taskId={taskId}
            projectId={projectId}
            workspaceSlug={workspaceSlug}
            editable={editable}
            canManageLabels={canManageLabels}
            members={members}
            labels={labels}
            onClose={onClose}
            onTaskUpdate={onTaskUpdate}
            onArchive={onArchive}
            onRefresh={onRefresh}
          />
        ) : (
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <span className="text-xs font-medium text-muted-foreground">Task details</span>
            <button
              type="button"
              onClick={onClose}
              className="flex size-8 pointer-coarse:size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close panel"
            >
              <X className="size-4" />
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
