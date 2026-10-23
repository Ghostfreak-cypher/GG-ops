"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import type { BoardData, TaskDTO } from "@/modules/task/server/dto";
import { useProjectView, filterAndSortTasks } from "@/modules/task/use-project-view";
import type { ViewFilters, SortKey, GroupKey } from "@/modules/task/use-project-view";
import type { SavedViewDTO } from "@/modules/saved-view/server/queries";
import { SavedViewsBar } from "./saved-views-bar";
import { ProjectHeader } from "./project-header";
import { ProjectToolbar } from "./project-toolbar";
import { ListView } from "./list-view";
import { BulkActionBar } from "./bulk-action-bar";
import { BoardView } from "./board/board-view";
import type { TaskRowCallbacks } from "./task-row";
import { CreateTaskModal } from "@/components/task/create-task-modal";
import { TaskPanel } from "@/components/task/task-panel";
import { usePusherRefresh } from "@/lib/use-pusher-refresh";

type Member = { id: string; name: string; image?: string | null };
type LabelOpt = { id: string; name: string; color: string | null };

// Module scope, so usePusherRefresh's effect deps stay stable: the React Compiler skips this
// component (eslint suppression below), and a fresh array per render reconnected the socket.
const TASK_EVENTS = ["task.changed"];

interface ProjectWorkspaceProps {
  board: BoardData;
  workspaceSlug: string;
  editable: boolean;
  canManageLabels: boolean;
  canManage?: boolean;
  members: Member[];
  labels: LabelOpt[];
  viewMode: "list" | "board";
  initialUrlFilters?: ViewFilters;
  savedViews?: SavedViewDTO[];
}

export function ProjectWorkspace({
  board,
  workspaceSlug,
  editable,
  canManageLabels,
  canManage = false,
  members,
  labels,
  viewMode,
  initialUrlFilters,
  savedViews = [],
}: ProjectWorkspaceProps) {
  // Covers BoardView too — it's only ever rendered as a child of this component, so its
  // own former copy of this same subscription was a duplicate (see board-view.tsx).
  usePusherRefresh(`project-${board.projectId}`, TASK_EVENTS);
  const router = useRouter();
  const pathname = usePathname();
  const {
    state, setSearch, setFilters, setSortBy, setGroupBy, setDensity,
    toggleShowCompleted, toggleSelect, selectAll, clearSelection,
  } = useProjectView(board.projectId, initialUrlFilters);

  function applyView(view: SavedViewDTO) {
    setFilters({
      statuses: view.filters.statuses as ViewFilters["statuses"],
      priorities: view.filters.priorities as ViewFilters["priorities"],
      assigneeIds: view.filters.assigneeIds,
      labelIds: view.filters.labelIds,
      dueDateFrom: view.filters.dueDateFrom,
      dueDateTo: view.filters.dueDateTo,
    });
    setSortBy(view.sortBy as SortKey);
    setGroupBy(view.groupBy as GroupKey);
  }

  // Sync active filters to URL so they can be bookmarked / shared
  React.useEffect(() => {
    const sp = new URLSearchParams();
    state.filters.statuses.forEach((s) => sp.append("s", s));
    state.filters.priorities.forEach((p) => sp.append("p", p));
    state.filters.assigneeIds.forEach((a) => sp.append("a", a));
    state.filters.labelIds.forEach((l) => sp.append("l", l));
    if (state.filters.dueDateFrom) sp.set("ddf", state.filters.dueDateFrom);
    if (state.filters.dueDateTo) sp.set("ddt", state.filters.dueDateTo);
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.filters]);

  const [tasks, setTasks] = React.useState<TaskDTO[]>(() => [
    ...board.sections.flatMap((s) => s.tasks),
    ...board.unsectioned,
  ]);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [panelTaskId, setPanelTaskId] = React.useState<string | null>(null);

  const visibleTasks = filterAndSortTasks(tasks, state);

  const isFiltered =
    !!state.search ||
    state.filters.statuses.length > 0 ||
    state.filters.priorities.length > 0 ||
    state.filters.assigneeIds.length > 0 ||
    state.filters.labelIds.length > 0 ||
    !!state.filters.dueDateFrom ||
    !!state.filters.dueDateTo ||
    !state.showCompleted;

  const selectedIdsArr = Array.from(state.selectedIds);

  const callbacks: TaskRowCallbacks = {
    onTaskClick: (taskId) => setPanelTaskId(taskId),
    onUpdate(taskId, patch) {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          return {
            ...t,
            ...(patch.status !== undefined ? { status: patch.status } : {}),
            ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
            ...(patch.title !== undefined ? { title: patch.title } : {}),
            ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate } : {}),
            ...(patch.assignees !== undefined ? { assignees: patch.assignees } : {}),
            ...(patch.labelIds !== undefined ? { labelIds: patch.labelIds } : {}),
            ...(patch.sectionId !== undefined ? { sectionId: patch.sectionId } : {}),
          } as TaskDTO;
        }),
      );
    },
    onArchive(taskId) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      clearSelection();
    },
  };

  function handleBulkSuccess(taskIds: string[], patch: Record<string, unknown>) {
    setTasks((prev) =>
      prev.map((t) => {
        if (!taskIds.includes(t.id)) return t;
        return {
          ...t,
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
          ...(patch.assigneeIds !== undefined
            ? {
                assignees: members
                  .filter((m) => (patch.assigneeIds as string[]).includes(m.id))
                  .map((m) => ({ id: m.id, name: m.name, image: m.image ?? null })),
              }
            : {}),
        } as TaskDTO;
      }),
    );
    clearSelection();
  }

  function handleBulkArchive(taskIds: string[]) {
    setTasks((prev) => prev.filter((t) => !taskIds.includes(t.id)));
  }

  function handleCreated() {
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 pb-24">
      <CreateTaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
        projectId={board.projectId}
        sections={board.sections}
        members={members}
        labels={labels}
      />

      <TaskPanel
        open={panelTaskId !== null}
        taskId={panelTaskId}
        projectId={board.projectId}
        workspaceSlug={workspaceSlug}
        editable={editable}
        canManageLabels={canManageLabels}
        members={members}
        labels={labels}
        onClose={() => setPanelTaskId(null)}
        onTaskUpdate={callbacks.onUpdate}
        onArchive={callbacks.onArchive}
        onRefresh={handleCreated}
      />

      <ProjectHeader
        board={board}
        allTasks={tasks}
        workspaceSlug={workspaceSlug}
        projectId={board.projectId}
        viewMode={viewMode}
        editable={editable}
        canManage={canManage}
        onNewTask={() => setModalOpen(true)}
      />

      <SavedViewsBar
          workspaceSlug={workspaceSlug}
          projectId={board.projectId}
          views={savedViews}
          currentFilters={state.filters}
          currentSortBy={state.sortBy}
          currentSortDir={state.sortDir}
          currentGroupBy={state.groupBy}
          currentShowCompleted={state.showCompleted}
          onApplyView={applyView}
        />

      <ProjectToolbar
        search={state.search}
        filters={state.filters}
        sortBy={state.sortBy}
        sortDir={state.sortDir}
        groupBy={state.groupBy}
        density={state.density}
        showCompleted={state.showCompleted}
        viewMode={viewMode}
        members={members}
        labels={labels}
        onSearch={setSearch}
        onFilters={setFilters}
        onSort={setSortBy}
        onGroupBy={setGroupBy}
        onDensity={setDensity}
        onToggleCompleted={toggleShowCompleted}
      />

      {viewMode === "list" ? (
        <ListView
          projectId={board.projectId}
          workspaceSlug={workspaceSlug}
          sections={board.sections}
          allTasks={tasks}
          visibleTasks={visibleTasks}
          editable={editable}
          canManageLabels={canManageLabels}
          selected={state.selectedIds}
          members={members}
          labels={labels}
          density={state.density}
          callbacks={callbacks}
          onSelect={toggleSelect}
          onSelectAll={(ids) => {
            if (ids.length === 0) clearSelection();
            else selectAll(ids);
          }}
          isFiltered={isFiltered}
          onCreated={handleCreated}
        />
      ) : (
        <BoardView
          board={{
            ...board,
            sections: board.sections.map((s) => ({
              ...s,
              tasks: visibleTasks.filter((t) => t.sectionId === s.id),
            })),
            unsectioned: visibleTasks.filter((t) => !t.sectionId),
          }}
          editable={editable}
          taskHrefBase={`/w/${workspaceSlug}/projects/${board.projectId}/tasks`}
          members={members}
          labels={labels}
          onTaskUpdate={callbacks.onUpdate}
          onTaskClick={(taskId) => setPanelTaskId(taskId)}
          onCreated={handleCreated}
        />
      )}

      <BulkActionBar
        selectedIds={selectedIdsArr}
        members={members}
        onClear={clearSelection}
        onBulkSuccess={handleBulkSuccess}
        onBulkArchive={handleBulkArchive}
      />
    </div>
  );
}
