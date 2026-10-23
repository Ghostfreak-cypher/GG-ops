"use client";

import * as React from "react";
import Link from "next/link";
import { format, isPast, isToday } from "date-fns";
import {
  CalendarDays,
  Check,
  Tag,
  MessageSquare,
  Paperclip,
  MoreHorizontal,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { updateTaskAction } from "@/modules/task/server/actions/update-task";
import { archiveTaskAction } from "@/modules/task/server/actions/archive-task";
import type { TaskDTO } from "@/modules/task/server/dto";
import { AssigneePopover } from "@/components/task/assignee-popover";
import { DueDatePopover } from "@/components/task/due-date-popover";
import { LabelPopover } from "@/components/task/label-popover";
import { Checkbox } from "@/components/ui/checkbox";
import { AvatarStack } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Member = { id: string; name: string; image?: string | null };
type LabelOpt = { id: string; name: string; color: string | null };

/**
 * Shared grid template for the list-view table. The header row and every task
 * row use this so columns line up. Below lg it collapses to Name + trailing menu;
 * the hidden (`display:none`) middle cells drop out of grid auto-placement.
 *
 * Expands at lg, not md: the sidebar reappears at md, which leaves ~474px of
 * content at a 768px viewport — less than the 568px the five fixed tracks and
 * their gaps need, so md overflowed the page horizontally.
 */
export const TASK_GRID =
  "grid grid-cols-[minmax(0,1fr)_40px] lg:grid-cols-[minmax(0,1fr)_180px_120px_180px_40px] items-center gap-2 lg:gap-3";

export interface TaskRowCallbacks {
  onUpdate: (taskId: string, patch: Partial<TaskDTO>) => void;
  onArchive: (taskId: string) => void;
  onTaskClick?: (taskId: string) => void;
}

interface TaskRowProps {
  task: TaskDTO;
  editable: boolean;
  workspaceSlug: string;
  canManageLabels: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  members: Member[];
  labels: LabelOpt[];
  href: string;
  density: "comfortable" | "compact";
  callbacks: TaskRowCallbacks;
}

function DueDateChip({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) return null;
  const d = new Date(dueDate);
  const overdue = isPast(d) && !isToday(d);
  const today = isToday(d);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border-2 px-1.5 py-0.5 font-display text-[10px] uppercase tracking-widest",
        overdue && "border-[#ff0000] text-[#ff0000]",
        today && "border-[#ffa500] text-[#ffa500]",
        !overdue && !today && "border-border/30 text-muted-foreground",
      )}
    >
      <CalendarDays className="size-3" />
      {format(d, "MMM d")}
    </span>
  );
}

/** Soft, label-colored pill background + text. Falls back to the secondary token. */
function labelPillStyle(color: string | null): React.CSSProperties | undefined {
  if (color && /^#[0-9a-fA-F]{6}$/.test(color)) {
    return { backgroundColor: `${color}1f`, color };
  }
  return undefined;
}

export function TaskRow({
  task,
  editable,
  workspaceSlug,
  canManageLabels,
  selected,
  onSelect,
  members,
  labels,
  href,
  density,
  callbacks,
}: TaskRowProps) {
  const [editing, setEditing] = React.useState(false);
  const [titleDraft, setTitleDraft] = React.useState(task.title);
  const [pending, start] = React.useTransition();

  const compact = density === "compact";
  const done = task.status === "DONE";

  function apply(patch: Partial<TaskDTO>) {
    callbacks.onUpdate(task.id, patch);
    start(async () => {
      const res = await updateTaskAction(task.id, patch as Record<string, unknown>);
      if (!res.ok) {
        toast.error(res.error ?? "Failed to update task");
        callbacks.onUpdate(task.id, {
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate,
          assignees: task.assignees,
          labelIds: task.labelIds,
        });
      }
    });
  }

  function commitTitle() {
    const t = titleDraft.trim();
    if (t && t !== task.title) {
      callbacks.onUpdate(task.id, { title: t });
      start(async () => {
        const res = await updateTaskAction(task.id, { title: t });
        if (!res.ok) {
          toast.error(res.error ?? "Failed to update title");
          setTitleDraft(task.title);
          callbacks.onUpdate(task.id, { title: task.title });
        }
      });
    } else {
      setTitleDraft(task.title);
    }
    setEditing(false);
  }

  const taskLabels = labels.filter((l) => task.labelIds.includes(l.id));
  const firstLabel = taskLabels[0];

  return (
    <div
      className={cn(
        TASK_GRID,
        "group relative border-b border-border px-3 transition-colors last:border-b-0",
        compact ? "py-1.5" : "py-2.5",
        selected ? "bg-muted" : "hover:bg-muted",
        pending && "opacity-70",
      )}
    >
      {/* Name cell: select + complete circle + title + counts */}
      <div className="flex min-w-0 items-center gap-2">
        <Checkbox
          checked={selected}
          onCheckedChange={() => onSelect(task.id)}
          className={cn(
            "shrink-0 transition-opacity",
            !selected && "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100",
          )}
          aria-label={`Select "${task.title}"`}
        />

        <button
          type="button"
          disabled={!editable}
          onClick={() => apply({ status: done ? "TODO" : "DONE" })}
          className={cn(
            "flex size-4.5 pointer-coarse:size-6 shrink-0 items-center justify-center border-2 transition-colors",
            done
              ? "border-border bg-primary text-primary-foreground"
              : "border-border/30 text-transparent hover:border-border hover:text-foreground/40",
            !editable && "cursor-default",
          )}
          aria-label={done ? "Mark incomplete" : "Mark complete"}
          title={done ? "Mark incomplete" : "Mark complete"}
        >
          <Check className="size-3" strokeWidth={3} />
        </button>

        {editing ? (
          <input
            autoFocus
            className="w-full bg-transparent text-sm font-medium outline-none"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitTitle();
              if (e.key === "Escape") {
                setTitleDraft(task.title);
                setEditing(false);
              }
            }}
          />
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            {callbacks.onTaskClick ? (
              <button
                type="button"
                onClick={() => callbacks.onTaskClick!(task.id)}
                className={cn(
                  "truncate text-left text-sm font-medium hover:underline",
                  done && "text-muted-foreground line-through",
                )}
              >
                {task.title}
              </button>
            ) : (
              <Link
                href={href}
                className={cn(
                  "truncate text-sm font-medium hover:underline",
                  done && "text-muted-foreground line-through",
                )}
              >
                {task.title}
              </Link>
            )}

            {task.blockedByCount > 0 && (
              <span
                className="shrink-0 border border-red-500 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-red-600"
                title={`Blocked by ${task.blockedByCount} task${task.blockedByCount === 1 ? "" : "s"}`}
              >
                Blocked
              </span>
            )}
            {task.commentCount > 0 && (
              <span
                className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground"
                title={`${task.commentCount} comment${task.commentCount === 1 ? "" : "s"}`}
              >
                <MessageSquare className="size-3.5" />
                {task.commentCount}
              </span>
            )}
            {task.attachmentCount > 0 && (
              <span
                className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground"
                title={`${task.attachmentCount} attachment${task.attachmentCount === 1 ? "" : "s"}`}
              >
                <Paperclip className="size-3.5" />
                {task.attachmentCount}
              </span>
            )}
          </div>
        )}

        {/* Below lg the assignee and due-date columns are hidden, so show them here read-only. */}
        {!editing && (task.dueDate || task.assignees.length > 0) && (
          <div className="ml-auto flex shrink-0 items-center gap-2 lg:hidden">
            <DueDateChip dueDate={task.dueDate} />
            {task.assignees.length > 0 && <AvatarStack people={task.assignees} size="xs" />}
          </div>
        )}
      </div>

      {/* Assignee cell */}
      <div className="hidden min-w-0 items-center lg:flex">
        <AssigneePopover
          value={task.assignees.map((a) => a.id)}
          members={members}
          disabled={!editable}
          onSelect={(assigneeIds) => {
            const newAssignees = members
              .filter((m) => assigneeIds.includes(m.id))
              .map((m) => ({ id: m.id, name: m.name, image: m.image ?? null }));
            apply({ assignees: newAssignees });
            start(async () => {
              const res = await updateTaskAction(task.id, { assigneeIds });
              if (!res.ok) toast.error(res.error ?? "Failed to update assignees");
            });
          }}
        >
          <button
            type="button"
            className="flex min-w-0 items-center gap-2 rounded-md text-left"
            title="Set assignees"
          >
            {task.assignees.length > 0 ? (
              <>
                <AvatarStack people={task.assignees} size="xs" />
                <span className="truncate text-sm text-muted-foreground">
                  {task.assignees[0].name}
                  {task.assignees.length > 1 ? ` +${task.assignees.length - 1}` : ""}
                </span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 pointer-coarse:opacity-100">
                Assign
              </span>
            )}
          </button>
        </AssigneePopover>
      </div>

      {/* Due date cell */}
      <div className="hidden items-center lg:flex">
        <DueDatePopover
          value={task.dueDate}
          disabled={!editable}
          onSelect={(dueDate) => apply({ dueDate })}
        >
          <button type="button" title="Set due date">
            {task.dueDate ? (
              <DueDateChip dueDate={task.dueDate} />
            ) : (
              <span className="flex items-center gap-1 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 pointer-coarse:opacity-100">
                <CalendarDays className="size-3.5" />
                Set date
              </span>
            )}
          </button>
        </DueDatePopover>
      </div>

      {/* Workstream (labels) cell */}
      <div className="hidden min-w-0 items-center lg:flex">
        <LabelPopover
          value={task.labelIds}
          labels={labels}
          disabled={!editable}
          workspaceSlug={workspaceSlug}
          canManage={canManageLabels}
          onSelect={(labelIds) => apply({ labelIds })}
        >
          <button type="button" className="flex min-w-0 items-center gap-1" title="Set workstream">
            {firstLabel ? (
              <>
                <span
                  className={cn(
                    "inline-flex max-w-full items-center truncate border-2 px-2 py-0.5 font-display text-[10px] uppercase tracking-widest",
                    !labelPillStyle(firstLabel.color) && "border-border text-foreground",
                  )}
                  style={labelPillStyle(firstLabel.color)}
                >
                  {firstLabel.name}
                </span>
                {taskLabels.length > 1 && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    +{taskLabels.length - 1}
                  </span>
                )}
              </>
            ) : (
              <span className="flex items-center gap-1 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 pointer-coarse:opacity-100">
                <Tag className="size-3.5" />
                Set workstream
              </span>
            )}
          </button>
        </LabelPopover>
      </div>

      {/* Overflow menu cell */}
      <div className="flex items-center justify-end">
        {editable && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex size-6 items-center justify-center border-2 border-transparent text-muted-foreground opacity-0 transition-opacity hover:border-border hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:size-10 pointer-coarse:opacity-100"
                aria-label="More options"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={href} className="gap-2">
                  <ExternalLink className="size-4" />
                  Open task
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setEditing(true)}>Rename</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                destructive
                onClick={() => {
                  callbacks.onArchive(task.id);
                  start(async () => {
                    const res = await archiveTaskAction(task.id);
                    if (!res.ok) toast.error(res.error ?? "Failed to archive task");
                  });
                }}
              >
                <Trash2 className="size-4" />
                Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
