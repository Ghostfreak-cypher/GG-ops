"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { format, isPast, isToday } from "date-fns";
import { CalendarDays, GripVertical } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { moveTaskAction } from "@/modules/task/server/actions/move-task";
import { updateTaskAction } from "@/modules/task/server/actions/update-task";
import type { BoardData, TaskDTO } from "@/modules/task/server/dto";
import { AddTaskInline } from "@/components/task/add-task-inline";
import { Badge } from "@/components/ui/badge";
import { AvatarStack } from "@/components/ui/avatar";
import { StatusPopover } from "@/components/task/status-popover";
import { PriorityPopover } from "@/components/task/priority-popover";
import { AssigneePopover } from "@/components/task/assignee-popover";
import { DueDatePopover } from "@/components/task/due-date-popover";
import { STATUS_UI, PRIORITY_UI } from "@/lib/task-ui";
import { cn } from "@/lib/utils";

type Member = { id: string; name: string; image?: string | null };
type LabelOpt = { id: string; name: string; color: string | null };

interface BoardViewProps {
  board: BoardData;
  editable: boolean;
  taskHrefBase: string;
  members?: Member[];
  labels?: LabelOpt[];
  onTaskUpdate?: (taskId: string, patch: Partial<TaskDTO>) => void;
  onTaskClick?: (taskId: string) => void;
  onCreated?: () => void;
}

function DueDateChip({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) return null;
  const d = new Date(dueDate);
  const overdue = isPast(d) && !isToday(d);
  const today = isToday(d);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs",
        overdue && "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
        today && "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
        !overdue && !today && "text-muted-foreground",
      )}
    >
      <CalendarDays className="size-3" />
      {format(d, "MMM d")}
    </span>
  );
}

function TaskCardMeta({
  task,
  editable,
  members = [],
  onUpdate,
}: {
  task: TaskDTO;
  editable: boolean;
  members: Member[];
  onUpdate: (patch: Partial<TaskDTO>) => void;
}) {
  const [, start] = useTransition();
  const statusUi = STATUS_UI[task.status];
  const priorityUi = PRIORITY_UI[task.priority];

  function apply(patch: Partial<TaskDTO>) {
    onUpdate(patch);
    start(async () => {
      const res = await updateTaskAction(task.id, patch as Record<string, unknown>);
      if (!res.ok) {
        toast.error(res.error ?? "Failed to update task");
        onUpdate({
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate,
          assignees: task.assignees,
        });
      }
    });
  }

  return (
    <div className="mt-2.5 flex items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Status */}
        <StatusPopover value={task.status} disabled={!editable} onSelect={(status) => apply({ status })}>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium transition-colors hover:opacity-80",
              statusUi.badge,
            )}
          >
            <span className={cn("size-1.5 rounded-full", statusUi.dot)} />
            {statusUi.label}
          </button>
        </StatusPopover>

        {/* Priority */}
        <PriorityPopover value={task.priority} disabled={!editable} onSelect={(priority) => apply({ priority })}>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium transition-colors hover:opacity-80",
              priorityUi.badge,
            )}
          >
            <span className={cn("size-1.5 rounded-full", priorityUi.dot)} />
            {priorityUi.label}
          </button>
        </PriorityPopover>

        {/* Due date */}
        <DueDatePopover value={task.dueDate} disabled={!editable} onSelect={(dueDate) => apply({ dueDate })}>
          <button type="button">
            <DueDateChip dueDate={task.dueDate} />
          </button>
        </DueDatePopover>
      </div>

      {/* Assignees */}
      {task.assignees.length > 0 && (
        <AssigneePopover
          value={task.assignees.map((a) => a.id)}
          members={members}
          disabled={!editable}
          onSelect={(assigneeIds) => {
            const newAssignees = members
              .filter((m) => assigneeIds.includes(m.id))
              .map((m) => ({ id: m.id, name: m.name, image: m.image ?? null }));
            onUpdate({ assignees: newAssignees });
            start(async () => {
              const res = await updateTaskAction(task.id, { assigneeIds });
              if (!res.ok) toast.error(res.error ?? "Failed to update assignees");
            });
          }}
        >
          <button type="button">
            <AvatarStack people={task.assignees} size="xs" />
          </button>
        </AssigneePopover>
      )}
    </div>
  );
}

type Col = {
  id: string;
  name: string;
  sectionId: string | null;
  tasks: TaskDTO[];
};

function buildCols(board: BoardData): Col[] {
  return [
    ...board.sections.map((s) => ({
      id: s.id,
      name: s.name,
      sectionId: s.id as string | null,
      tasks: s.tasks,
    })),
    { id: "__none__", name: "No section", sectionId: null, tasks: board.unsectioned },
  ];
}

export function BoardView({
  board,
  editable,
  taskHrefBase,
  members = [],
  onTaskUpdate,
  onTaskClick,
  onCreated,
}: BoardViewProps) {
  // Realtime refresh for this channel/event is already subscribed by the parent
  // ProjectWorkspace (the only place BoardView is rendered) — a second identical
  // subscription here just doubled every refetch.
  const [cols, setCols] = useState<Col[]>(() => buildCols(board));
  const [, start] = useTransition();
  // See list-view: PointerSensor needs touch-action:none, which blocks the column's
  // vertical scroll and the board's horizontal pan. TouchSensor's delay lets a flick
  // scroll and a long press drag; the cards drop `touch-none` accordingly.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleUpdate(taskId: string, patch: Partial<TaskDTO>) {
    setCols((prev) =>
      prev.map((c) => ({
        ...c,
        tasks: c.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } as TaskDTO : t)),
      })),
    );
    onTaskUpdate?.(taskId, patch);
  }

  function onDragEnd(e: DragEndEvent) {
    const activeId = String(e.active.id);
    if (!e.over) return;
    const overId = String(e.over.id);

    const source = cols.find((c) => c.tasks.some((t) => t.id === activeId));
    if (!source) return;

    let dest: Col | undefined;
    let destIndex: number;
    if (overId.startsWith("col:")) {
      dest = cols.find((c) => c.id === overId.slice(4));
      destIndex = dest ? dest.tasks.length : 0;
    } else {
      dest = cols.find((c) => c.tasks.some((t) => t.id === overId));
      destIndex = dest ? dest.tasks.findIndex((t) => t.id === overId) : 0;
    }
    if (!dest) return;
    if (
      source.id === dest.id &&
      source.tasks.findIndex((t) => t.id === activeId) === destIndex
    ) {
      return;
    }

    const moving = source.tasks.find((t) => t.id === activeId);
    if (!moving) return;

    const prev = cols;
    const next = cols.map((c) => ({ ...c, tasks: c.tasks.filter((t) => t.id !== activeId) }));
    const destCol = next.find((c) => c.id === dest!.id)!;
    destCol.tasks = [
      ...destCol.tasks.slice(0, destIndex),
      moving,
      ...destCol.tasks.slice(destIndex),
    ];
    setCols(next);

    const orderedIds = destCol.tasks.map((t) => t.id);
    const destSectionId = dest.sectionId;
    start(async () => {
      const res = await moveTaskAction(activeId, { destSectionId, orderedIds });
      if (!res.ok) {
        setCols(prev);
        toast.error(res.error ?? "Failed to move task");
      }
    });
  }

  function handleCreatedInColumn() {
    onCreated?.();
  }

  if (!editable) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-6">
        {cols.map((col) => (
          <div key={col.id} className="w-72 shrink-0">
            <ColumnHeader name={col.name} count={col.tasks.length} />
            <ul className="space-y-2">
              {col.tasks.map((t) => (
                <li key={t.id} className="rounded-xl border border-border bg-card p-3 shadow-sm">
                  <TaskCard
                    task={t}
                    href={`${taskHrefBase}/${t.id}`}
                    editable={false}
                    members={members}
                    onUpdate={(patch) => handleUpdate(t.id, patch)}
                    onTaskClick={onTaskClick}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  return (
    <DndContext
      id={`board-dnd-${board.projectId}`}
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragEnd={onDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-6">
        {cols.map((col) => (
          <Column
            key={col.id}
            col={col}
            hrefBase={taskHrefBase}
            members={members}
            onUpdate={handleUpdate}
            onTaskClick={onTaskClick}
            projectId={board.projectId}
            onCreated={handleCreatedInColumn}
          />
        ))}
      </div>
    </DndContext>
  );
}

function ColumnHeader({ name, count }: { name: string; count: number }) {
  return (
    <div className="mb-2 flex items-center gap-2 px-1">
      <h3 className="text-sm font-semibold">{name}</h3>
      <Badge variant="secondary" className="text-xs">
        {count}
      </Badge>
    </div>
  );
}

function Column({
  col,
  hrefBase,
  members,
  onUpdate,
  onTaskClick,
  projectId,
  onCreated,
}: {
  col: Col;
  hrefBase: string;
  members: Member[];
  onUpdate: (taskId: string, patch: Partial<TaskDTO>) => void;
  onTaskClick?: (taskId: string) => void;
  projectId: string;
  onCreated: () => void;
}) {
  const { setNodeRef } = useDroppable({ id: `col:${col.id}` });
  return (
    <div className="w-72 shrink-0">
      <ColumnHeader name={col.name} count={col.tasks.length} />
      <SortableContext items={col.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ul
          ref={setNodeRef}
          className="min-h-24 space-y-2 rounded-xl border border-dashed border-border bg-muted/20 p-2"
        >
          {col.tasks.length === 0 ? (
            <li className="flex items-center justify-center py-6 text-xs text-muted-foreground">
              Drop tasks here
            </li>
          ) : (
            col.tasks.map((t) => (
              <SortableTaskCard
                key={t.id}
                task={t}
                href={`${hrefBase}/${t.id}`}
                members={members}
                onUpdate={(patch) => onUpdate(t.id, patch)}
                onTaskClick={onTaskClick}
              />
            ))
          )}
        </ul>
      </SortableContext>
      <div className="mt-1">
        <AddTaskInline
          projectId={projectId}
          sectionId={col.sectionId}
          onCreated={onCreated}
        />
      </div>
    </div>
  );
}

function TaskCard({
  task,
  href,
  editable,
  members,
  onUpdate,
  onTaskClick,
  dragHandleProps,
}: {
  task: TaskDTO;
  href: string;
  editable: boolean;
  members: Member[];
  onUpdate: (patch: Partial<TaskDTO>) => void;
  onTaskClick?: (taskId: string) => void;
  dragHandleProps?: Record<string, unknown>;
}) {
  return (
    <div className="group">
      {dragHandleProps && (
        <div
          className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100 cursor-grab text-muted-foreground"
          {...dragHandleProps}
        >
          <GripVertical className="size-4" />
        </div>
      )}
      {task.blockedByCount > 0 && (
        <span className="mb-1.5 inline-block border border-red-500 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-red-600">
          Blocked
        </span>
      )}
      {onTaskClick ? (
        <button
          type="button"
          onClick={() => onTaskClick(task.id)}
          className={cn(
            "block text-left text-sm font-medium leading-snug hover:text-primary",
            task.status === "DONE" && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </button>
      ) : (
        <Link
          href={href}
          className={cn(
            "block text-sm font-medium leading-snug hover:text-primary",
            task.status === "DONE" && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </Link>
      )}
      <TaskCardMeta task={task} editable={editable} members={members} onUpdate={onUpdate} />
    </div>
  );
}

function SortableTaskCard({
  task,
  href,
  members,
  onUpdate,
  onTaskClick,
}: {
  task: TaskDTO;
  href: string;
  members: Member[];
  onUpdate: (patch: Partial<TaskDTO>) => void;
  onTaskClick?: (taskId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative cursor-grab rounded-xl border border-border bg-card p-3 shadow-sm transition-all pointer-coarse:select-none [-webkit-touch-callout:none]",
        "hover:border-primary/30 hover:shadow-md active:cursor-grabbing",
        isDragging && "ring-2 ring-primary/20 shadow-pop",
      )}
      {...attributes}
      {...listeners}
    >
      <TaskCard
        task={task}
        href={href}
        editable
        members={members}
        onUpdate={onUpdate}
        onTaskClick={onTaskClick}
      />
    </li>
  );
}
