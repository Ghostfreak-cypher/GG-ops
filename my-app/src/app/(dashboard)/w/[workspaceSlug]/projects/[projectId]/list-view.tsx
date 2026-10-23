"use client";

import * as React from "react";
import { useTransition } from "react";
import { ChevronDown, ChevronRight, MoreHorizontal, Trash2 } from "lucide-react";
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
import type { TaskDTO, BoardSection } from "@/modules/task/server/dto";
import { moveTaskAction } from "@/modules/task/server/actions/move-task";
import { renameSectionAction } from "@/modules/section/server/actions/rename-section";
import { deleteSectionAction } from "@/modules/section/server/actions/delete-section";
import { TaskRow, TASK_GRID, type TaskRowCallbacks } from "./task-row";
import { AddTaskInline } from "@/components/task/add-task-inline";
import { AddSectionInline } from "./add-section-inline";
import { EmptyState } from "./empty-state";
import type { Density } from "@/modules/task/use-project-view";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Member = { id: string; name: string; image?: string | null };
type LabelOpt = { id: string; name: string; color: string | null };

const UNSECTIONED_ID = "__none__";

type Group = {
  id: string;
  name: string;
  sectionId: string | null;
  tasks: TaskDTO[];
};

function buildGroups(sections: BoardSection[], tasks: TaskDTO[]): Group[] {
  const bySection = new Map<string, TaskDTO[]>();
  for (const s of sections) bySection.set(s.id, []);
  const unsectioned: TaskDTO[] = [];
  for (const t of tasks) {
    if (t.sectionId && bySection.has(t.sectionId)) bySection.get(t.sectionId)!.push(t);
    else unsectioned.push(t);
  }
  const groups: Group[] = sections.map((s) => ({
    id: s.id,
    name: s.name,
    sectionId: s.id,
    tasks: bySection.get(s.id) ?? [],
  }));
  if (unsectioned.length > 0 || groups.length === 0) {
    groups.push({ id: UNSECTIONED_ID, name: "No section", sectionId: null, tasks: unsectioned });
  }
  return groups;
}

function loadCollapsed(projectId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(`section-collapsed-${projectId}`);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveCollapsed(projectId: string, ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`section-collapsed-${projectId}`, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

interface ListViewProps {
  projectId: string;
  workspaceSlug: string;
  sections: BoardSection[];
  allTasks: TaskDTO[];
  visibleTasks: TaskDTO[];
  editable: boolean;
  canManageLabels: boolean;
  selected: Set<string>;
  members: Member[];
  labels: LabelOpt[];
  density: Density;
  callbacks: TaskRowCallbacks;
  onSelect: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  isFiltered: boolean;
  onCreated: () => void;
}

function TableHeader({
  allSelected,
  onToggleAll,
}: {
  allSelected: boolean;
  onToggleAll: () => void;
}) {
  return (
    <div
      className={cn(
        TASK_GRID,
        "sticky top-0 z-10 max-lg:top-14 border-b-[3px] border-border bg-muted px-3 py-2 font-display text-[10px] uppercase tracking-widest text-foreground",
      )}
    >
      <div className="flex items-center gap-2">
        <Checkbox
          checked={allSelected}
          onCheckedChange={onToggleAll}
          aria-label="Select all tasks"
        />
        <span>Name</span>
      </div>
      <div className="hidden lg:flex">Assignee</div>
      <div className="hidden lg:flex">Due date</div>
      <div className="hidden lg:flex">Workstream</div>
      <div className="hidden lg:flex" />
    </div>
  );
}

function SectionHeader({
  group,
  editable,
  collapsed,
  onToggleCollapse,
}: {
  group: Group;
  editable: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `section:${group.id}` });
  const [editing, setEditing] = React.useState(false);
  const [nameDraft, setNameDraft] = React.useState(group.name);
  const [, start] = useTransition();
  const isRealSection = group.sectionId !== null;

  function commitRename() {
    const n = nameDraft.trim();
    setEditing(false);
    if (!n || n === group.name || !group.sectionId) {
      setNameDraft(group.name);
      return;
    }
    start(async () => {
      const res = await renameSectionAction(group.sectionId!, { name: n });
      if (!res.ok) {
        toast.error(res.error ?? "Failed to rename section");
        setNameDraft(group.name);
      }
    });
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-1.5",
        isOver && "bg-primary/10",
      )}
    >
      <button
        type="button"
        onClick={onToggleCollapse}
        className="flex size-5 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
        aria-label={collapsed ? "Expand section" : "Collapse section"}
      >
        {collapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
      </button>

      {editing ? (
        <input
          autoFocus
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") {
              setNameDraft(group.name);
              setEditing(false);
            }
          }}
          className="bg-transparent text-sm font-semibold outline-none"
        />
      ) : (
        <button
          type="button"
          disabled={!editable || !isRealSection}
          onClick={() => setEditing(true)}
          className="text-left text-sm font-semibold disabled:cursor-default"
        >
          {group.name}
        </button>
      )}

      <Badge variant="secondary" className="text-xs">
        {group.tasks.length}
      </Badge>

      {editable && isRealSection && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="ml-auto flex size-6 items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label="Section options"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditing(true)}>Rename</DropdownMenuItem>
            <DropdownMenuItem
              destructive
              onClick={() => {
                start(async () => {
                  const res = await deleteSectionAction(group.sectionId!);
                  if (!res.ok) toast.error(res.error ?? "Failed to delete section");
                });
              }}
            >
              <Trash2 className="size-4" />
              Delete section
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

function SortableRow({
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
}: {
  task: TaskDTO;
  editable: boolean;
  workspaceSlug: string;
  canManageLabels: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  members: Member[];
  labels: LabelOpt[];
  href: string;
  density: Density;
  callbacks: TaskRowCallbacks;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    // The whole row is the drag target, so stop iOS long-press from selecting text or
    // opening the link preview before the 250ms touch-drag delay kicks in.
    <div
      ref={setNodeRef}
      style={style}
      className="pointer-coarse:select-none [-webkit-touch-callout:none]"
      {...attributes}
      {...listeners}
    >
      <TaskRow
        task={task}
        editable={editable}
        workspaceSlug={workspaceSlug}
        canManageLabels={canManageLabels}
        selected={selected}
        onSelect={onSelect}
        members={members}
        labels={labels}
        href={href}
        density={density}
        callbacks={callbacks}
      />
    </div>
  );
}

function SectionGroup({
  group,
  projectId,
  workspaceSlug,
  editable,
  collapsed,
  onToggleCollapse,
  isFiltered,
  callbacks,
  onCreated,
  ...rowProps
}: {
  group: Group;
  projectId: string;
  workspaceSlug: string;
  editable: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  isFiltered: boolean;
  onCreated: () => void;
  callbacks: TaskRowCallbacks;
} & Pick<ListViewProps, "canManageLabels" | "selected" | "onSelect" | "members" | "labels" | "density">) {
  const { setNodeRef } = useDroppable({ id: `section:${group.id}` });

  return (
    <div>
      <SectionHeader
        group={group}
        editable={editable}
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
      />
      {!collapsed && (
        <div ref={setNodeRef}>
          {editable ? (
            <SortableContext
              items={group.tasks.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              {group.tasks.map((task) => (
                <SortableRow
                  key={task.id}
                  task={task}
                  editable={editable}
                  workspaceSlug={workspaceSlug}
                  canManageLabels={rowProps.canManageLabels}
                  selected={rowProps.selected.has(task.id)}
                  onSelect={rowProps.onSelect}
                  members={rowProps.members}
                  labels={rowProps.labels}
                  href={`/w/${workspaceSlug}/projects/${projectId}/tasks/${task.id}`}
                  density={rowProps.density}
                  callbacks={callbacks}
                />
              ))}
            </SortableContext>
          ) : (
            group.tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                editable={editable}
                workspaceSlug={workspaceSlug}
                canManageLabels={rowProps.canManageLabels}
                selected={rowProps.selected.has(task.id)}
                onSelect={rowProps.onSelect}
                members={rowProps.members}
                labels={rowProps.labels}
                href={`/w/${workspaceSlug}/projects/${projectId}/tasks/${task.id}`}
                density={rowProps.density}
                callbacks={callbacks}
              />
            ))
          )}
          {editable && !isFiltered && (
            <AddTaskInline projectId={projectId} sectionId={group.sectionId} onCreated={onCreated} />
          )}
        </div>
      )}
    </div>
  );
}

export function ListView({
  projectId,
  workspaceSlug,
  sections,
  visibleTasks,
  editable,
  canManageLabels,
  selected,
  members,
  labels,
  density,
  callbacks,
  onSelect,
  onSelectAll,
  isFiltered,
  onCreated,
}: ListViewProps) {
  const showAddRow = editable && !isFiltered;
  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => loadCollapsed(projectId));
  const [, start] = useTransition();
  // PointerSensor cannot give both drag and scroll on touch: it needs touch-action:none
  // to survive pointercancel, which is exactly what kills native scrolling. TouchSensor
  // installs its own non-passive touchmove listener, so a long press drags while a flick
  // still scrolls. MouseSensor keeps desktop's instant 8px drag unchanged.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      saveCollapsed(projectId, next);
      return next;
    });
  }

  if (visibleTasks.length === 0 && !showAddRow) {
    return <EmptyState isFiltered={isFiltered} />;
  }

  const allIds = visibleTasks.map((t) => t.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const groups = buildGroups(sections, visibleTasks);

  function onDragEnd(e: DragEndEvent) {
    const activeId = String(e.active.id);
    if (!e.over) return;
    const overId = String(e.over.id);

    const source = groups.find((g) => g.tasks.some((t) => t.id === activeId));
    if (!source) return;

    let dest: Group | undefined;
    let destIndex: number;
    if (overId.startsWith("section:")) {
      dest = groups.find((g) => g.id === overId.slice(8));
      destIndex = dest ? dest.tasks.length : 0;
    } else {
      dest = groups.find((g) => g.tasks.some((t) => t.id === overId));
      destIndex = dest ? dest.tasks.findIndex((t) => t.id === overId) : 0;
    }
    if (!dest) return;
    if (source.id === dest.id && source.tasks.findIndex((t) => t.id === activeId) === destIndex) {
      return;
    }

    const moving = source.tasks.find((t) => t.id === activeId);
    if (!moving) return;

    const destTasks = dest.tasks.filter((t) => t.id !== activeId);
    const insertAt = overId.startsWith("section:") ? destTasks.length : destIndex;
    const orderedIds = [
      ...destTasks.slice(0, insertAt).map((t) => t.id),
      activeId,
      ...destTasks.slice(insertAt).map((t) => t.id),
    ];
    const destSectionId = dest.sectionId;

    callbacks.onUpdate(activeId, { sectionId: destSectionId } as Partial<TaskDTO>);

    start(async () => {
      const res = await moveTaskAction(activeId, { destSectionId, orderedIds });
      if (!res.ok) {
        toast.error(res.error ?? "Failed to move task");
        callbacks.onUpdate(activeId, { sectionId: moving.sectionId } as Partial<TaskDTO>);
      }
    });
  }

  const body = (
    <div>
      {groups.map((group) => (
        <SectionGroup
          key={group.id}
          group={group}
          projectId={projectId}
          workspaceSlug={workspaceSlug}
          editable={editable}
          collapsed={collapsed.has(group.id)}
          onToggleCollapse={() => toggleCollapse(group.id)}
          isFiltered={isFiltered}
          onCreated={onCreated}
          callbacks={callbacks}
          canManageLabels={canManageLabels}
          selected={selected}
          onSelect={onSelect}
          members={members}
          labels={labels}
          density={density}
        />
      ))}
    </div>
  );

  return (
    <div className="border-[3px] border-border bg-card">
      <TableHeader
        allSelected={allSelected}
        onToggleAll={() => onSelectAll(allSelected ? [] : allIds)}
      />

      {editable ? (
        <DndContext
          id={`list-dnd-${projectId}`}
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragEnd={onDragEnd}
        >
          {body}
        </DndContext>
      ) : (
        body
      )}

      {showAddRow && (
        <div className="px-3 py-1.5">
          <AddSectionInline projectId={projectId} onCreated={onCreated} />
        </div>
      )}
    </div>
  );
}
