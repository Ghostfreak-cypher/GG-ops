"use client";

import { useState, useEffect, useCallback } from "react";
import type { TaskDTO } from "@/modules/task/server/dto";
import type { TaskStatus, TaskPriority } from "@/modules/task/constants";

export type SortKey = "title" | "dueDate" | "priority" | "status" | "created";
export type GroupKey = "section" | "status" | "priority" | "assignee" | "none";
export type Density = "comfortable" | "compact";

export type ViewFilters = {
  statuses: TaskStatus[];
  priorities: TaskPriority[];
  assigneeIds: string[];
  labelIds: string[];
  dueDateFrom: string | null;
  dueDateTo: string | null;
};

export const EMPTY_FILTERS: ViewFilters = {
  statuses: [],
  priorities: [],
  assigneeIds: [],
  labelIds: [],
  dueDateFrom: null,
  dueDateTo: null,
};

export type ProjectViewState = {
  search: string;
  filters: ViewFilters;
  sortBy: SortKey;
  sortDir: "asc" | "desc";
  groupBy: GroupKey;
  density: Density;
  showCompleted: boolean;
  selectedIds: Set<string>;
};

const PRIORITY_ORDER: Record<string, number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

const STATUS_ORDER: Record<string, number> = {
  BLOCKED: 0,
  IN_PROGRESS: 1,
  TODO: 2,
  DONE: 3,
};

function loadViewState(projectId: string): Partial<ProjectViewState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(`project-view-${projectId}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<ProjectViewState>;
    return {
      sortBy: parsed.sortBy,
      sortDir: parsed.sortDir,
      groupBy: parsed.groupBy,
      density: parsed.density,
      showCompleted: parsed.showCompleted,
      filters: parsed.filters,
    };
  } catch {
    return {};
  }
}

function saveViewState(projectId: string, state: ProjectViewState) {
  if (typeof window === "undefined") return;
  try {
    const { selectedIds: _s, search: _q, ...rest } = state;
    localStorage.setItem(`project-view-${projectId}`, JSON.stringify(rest));
  } catch {
    /* ignore */
  }
}

export function useProjectView(projectId: string, overrideFilters?: ViewFilters) {
  const [state, setState] = useState<ProjectViewState>(() => {
    const saved = loadViewState(projectId);
    const base = saved.filters ?? EMPTY_FILTERS;
    return {
      search: "",
      filters: overrideFilters ?? { ...EMPTY_FILTERS, ...base },
      sortBy: saved.sortBy ?? "title",
      sortDir: saved.sortDir ?? "asc",
      groupBy: saved.groupBy ?? "section",
      density: saved.density ?? "comfortable",
      showCompleted: saved.showCompleted ?? true,
      selectedIds: new Set(),
    };
  });

  useEffect(() => {
    saveViewState(projectId, state);
  }, [projectId, state]);

  const setSearch = useCallback((search: string) => {
    setState((s) => ({ ...s, search, selectedIds: new Set() }));
  }, []);

  const setFilters = useCallback((filters: ViewFilters) => {
    setState((s) => ({ ...s, filters, selectedIds: new Set() }));
  }, []);

  const setSortBy = useCallback((sortBy: SortKey) => {
    setState((s) => ({
      ...s,
      sortBy,
      sortDir: s.sortBy === sortBy && s.sortDir === "asc" ? "desc" : "asc",
    }));
  }, []);

  const setGroupBy = useCallback((groupBy: GroupKey) => {
    setState((s) => ({ ...s, groupBy, selectedIds: new Set() }));
  }, []);

  const setDensity = useCallback((density: Density) => {
    setState((s) => ({ ...s, density }));
  }, []);

  const toggleShowCompleted = useCallback(() => {
    setState((s) => ({ ...s, showCompleted: !s.showCompleted, selectedIds: new Set() }));
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setState((s) => {
      const next = new Set(s.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...s, selectedIds: next };
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setState((s) => ({ ...s, selectedIds: new Set(ids) }));
  }, []);

  const clearSelection = useCallback(() => {
    setState((s) => ({ ...s, selectedIds: new Set() }));
  }, []);

  return {
    state,
    setSearch,
    setFilters,
    setSortBy,
    setGroupBy,
    setDensity,
    toggleShowCompleted,
    toggleSelect,
    selectAll,
    clearSelection,
  };
}

export function filterAndSortTasks(
  tasks: TaskDTO[],
  state: ProjectViewState,
): TaskDTO[] {
  let result = tasks;

  if (!state.showCompleted) {
    result = result.filter((t) => t.status !== "DONE");
  }

  const q = state.search.trim().toLowerCase();
  if (q) {
    result = result.filter((t) => t.title.toLowerCase().includes(q));
  }

  const { filters } = state;
  if (filters.statuses.length) {
    result = result.filter((t) => filters.statuses.includes(t.status));
  }
  if (filters.priorities.length) {
    result = result.filter((t) => filters.priorities.includes(t.priority));
  }
  if (filters.assigneeIds.length) {
    result = result.filter((t) => t.assignees.some((a) => filters.assigneeIds.includes(a.id)));
  }
  if (filters.labelIds.length) {
    result = result.filter((t) => t.labelIds.some((id) => filters.labelIds.includes(id)));
  }
  if (filters.dueDateFrom) {
    result = result.filter((t) => !!t.dueDate && t.dueDate >= filters.dueDateFrom!);
  }
  if (filters.dueDateTo) {
    result = result.filter((t) => !!t.dueDate && t.dueDate <= filters.dueDateTo!);
  }

  result = [...result].sort((a, b) => {
    let cmp = 0;
    switch (state.sortBy) {
      case "title":
        cmp = a.title.localeCompare(b.title);
        break;
      case "dueDate":
        cmp = (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
        break;
      case "priority":
        cmp = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
        break;
      case "status":
        cmp = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
        break;
    }
    return state.sortDir === "desc" ? -cmp : cmp;
  });

  return result;
}
