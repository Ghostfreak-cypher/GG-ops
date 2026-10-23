"use client";

import * as React from "react";
import { Search, Filter, ArrowUpDown, Group, Eye, EyeOff, X, Check, ChevronDown, CalendarRange } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TASK_STATUSES, TASK_PRIORITIES } from "@/modules/task/constants";
import { STATUS_UI, PRIORITY_UI } from "@/lib/task-ui";
import type {
  ViewFilters,
  SortKey,
  GroupKey,
  Density,
} from "@/modules/task/use-project-view";
import { EMPTY_FILTERS } from "@/modules/task/use-project-view";
import { cn } from "@/lib/utils";

type Member = { id: string; name: string };
type LabelOpt = { id: string; name: string };

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "title", label: "Name" },
  { key: "dueDate", label: "Due date" },
  { key: "priority", label: "Priority" },
  { key: "status", label: "Status" },
];

const GROUP_OPTIONS: { key: GroupKey; label: string }[] = [
  { key: "section", label: "Section" },
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority" },
  { key: "assignee", label: "Assignee" },
  { key: "none", label: "None" },
];

interface FilterPopoverProps {
  filters: ViewFilters;
  members: Member[];
  labels: LabelOpt[];
  onChange: (f: ViewFilters) => void;
}

function FilterPopover({ filters, members, labels, onChange }: FilterPopoverProps) {
  const activeCount =
    filters.statuses.length +
    filters.priorities.length +
    filters.assigneeIds.length +
    filters.labelIds.length +
    (filters.dueDateFrom ? 1 : 0) +
    (filters.dueDateTo ? 1 : 0);

  function toggleMulti<T extends string>(
    arr: T[],
    val: T,
    field: keyof ViewFilters,
  ) {
    const next = arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
    onChange({ ...filters, [field]: next });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Filter className="size-3.5" />
          <span className="sr-only sm:not-sr-only">Filter</span>
          {activeCount > 0 && (
            <span className="flex size-4 items-center justify-center border-2 border-background bg-foreground text-[10px] font-bold text-background">
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="space-y-3">
          {/* Status */}
          <div>
            <p className="mb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</p>
            <div className="flex flex-wrap gap-1.5">
              {TASK_STATUSES.map((s) => {
                const ui = STATUS_UI[s];
                const active = filters.statuses.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleMulti(filters.statuses, s, "statuses")}
                    className={cn(
                      "flex items-center gap-1.5 border-2 px-2 py-1 font-display text-[10px] uppercase tracking-widest transition-colors",
                      active
                        ? "border-border bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-primary hover:text-primary-foreground",
                    )}
                  >
                    <span className={cn("size-1.5 rounded-full", ui.dot)} />
                    {ui.label}
                  </button>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Priority */}
          <div>
            <p className="mb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Priority</p>
            <div className="flex flex-wrap gap-1.5">
              {TASK_PRIORITIES.map((p) => {
                const ui = PRIORITY_UI[p];
                const active = filters.priorities.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => toggleMulti(filters.priorities, p, "priorities")}
                    className={cn(
                      "flex items-center gap-1.5 border-2 px-2 py-1 font-display text-[10px] uppercase tracking-widest transition-colors",
                      active
                        ? "border-border bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-primary hover:text-primary-foreground",
                    )}
                  >
                    <span className={cn("size-1.5 rounded-full", ui.dot)} />
                    {ui.label}
                  </button>
                );
              })}
            </div>
          </div>

          {members.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="mb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Assignee</p>
                <div className="flex flex-col gap-0.5">
                  {members.slice(0, 8).map((m) => {
                    const active = filters.assigneeIds.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleMulti(filters.assigneeIds, m.id, "assigneeIds")}
                        className={cn(
                          "flex items-center gap-2 border-2 px-2 py-1 font-sans text-xs transition-colors",
                          active ? "border-border bg-primary text-primary-foreground" : "border-transparent hover:border-border",
                        )}
                      >
                        {active && <Check className="size-3.5 text-primary" />}
                        {!active && <span className="size-3.5" />}
                        {m.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {labels.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="mb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Label</p>
                <div className="flex flex-wrap gap-1.5">
                  {labels.slice(0, 10).map((l) => {
                    const active = filters.labelIds.includes(l.id);
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => toggleMulti(filters.labelIds, l.id, "labelIds")}
                        className={cn(
                          "border-2 px-2 py-1 font-display text-[10px] uppercase tracking-widest transition-colors",
                          active
                            ? "border-border bg-primary text-primary-foreground"
                            : "border-border bg-background text-foreground hover:bg-primary hover:text-primary-foreground",
                        )}
                      >
                        {l.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Due date range */}
          <Separator />
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <CalendarRange className="size-3.5" />
              Due date range
            </p>
            <div className="flex flex-col gap-1.5">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                From
                <input
                  type="date"
                  className="border-2 border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:border-[3px]"
                  value={filters.dueDateFrom ?? ""}
                  onChange={(e) => onChange({ ...filters, dueDateFrom: e.target.value || null })}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                To
                <input
                  type="date"
                  className="border-2 border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:border-[3px]"
                  value={filters.dueDateTo ?? ""}
                  onChange={(e) => onChange({ ...filters, dueDateTo: e.target.value || null })}
                />
              </label>
            </div>
          </div>

          {activeCount > 0 && (
            <>
              <Separator />
              <button
                type="button"
                className="flex w-full items-center justify-center gap-1.5 border-2 border-border py-1 font-display text-[10px] uppercase tracking-widest transition-colors hover:bg-primary hover:text-primary-foreground"
                onClick={() => onChange(EMPTY_FILTERS)}
              >
                <X className="size-3.5" />
                Clear all filters
              </button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface ProjectToolbarProps {
  search: string;
  filters: ViewFilters;
  sortBy: SortKey;
  sortDir: "asc" | "desc";
  groupBy: GroupKey;
  density: Density;
  showCompleted: boolean;
  viewMode: "list" | "board";
  members: Member[];
  labels: LabelOpt[];
  onSearch: (q: string) => void;
  onFilters: (f: ViewFilters) => void;
  onSort: (key: SortKey) => void;
  onGroupBy: (key: GroupKey) => void;
  onDensity: (d: Density) => void;
  onToggleCompleted: () => void;
}

export function ProjectToolbar({
  search,
  filters,
  sortBy,
  sortDir,
  groupBy,
  density,
  showCompleted,
  viewMode,
  members,
  labels,
  onSearch,
  onFilters,
  onSort,
  onGroupBy,
  onDensity,
  onToggleCompleted,
}: ProjectToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b-[3px] border-border pb-3">
      {/* Search */}
      <div className="relative w-full sm:w-auto">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search tasks…"
          className="h-9 w-full sm:w-52 border-[3px] border-border bg-input pl-8 pr-3 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-[5px] focus:outline-none"
        />
        {search && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => onSearch("")}
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Filter */}
      <FilterPopover filters={filters} members={members} labels={labels} onChange={onFilters} />

      {/* Sort */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowUpDown className="size-3.5" />
            <span className="sr-only sm:not-sr-only">
              {SORT_OPTIONS.find((o) => o.key === sortBy)?.label ?? "Sort"}
            </span>
            <ChevronDown className="size-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Sort by</DropdownMenuLabel>
          {SORT_OPTIONS.map((o) => (
            <DropdownMenuItem
              key={o.key}
              onClick={() => onSort(o.key)}
              className="justify-between"
            >
              {o.label}
              {sortBy === o.key && (
                <span className="text-xs text-muted-foreground">
                  {sortDir === "asc" ? "↑" : "↓"}
                </span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Group by — board only; the list view is a flat table */}
      {viewMode === "board" && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Group className="size-3.5" />
              <span className="sr-only sm:not-sr-only">
                {GROUP_OPTIONS.find((o) => o.key === groupBy)?.label ?? "Group"}
              </span>
              <ChevronDown className="size-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Group by</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={groupBy} onValueChange={(v) => onGroupBy(v as GroupKey)}>
              {GROUP_OPTIONS.map((o) => (
                <DropdownMenuRadioItem key={o.key} value={o.key}>
                  {o.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Density */}
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => onDensity(density === "comfortable" ? "compact" : "comfortable")}
        title={density === "comfortable" ? "Switch to compact" : "Switch to comfortable"}
      >
        {density === "comfortable" ? (
          <svg className="size-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="3" width="12" height="3" rx="0.5" />
            <rect x="2" y="9" width="12" height="3" rx="0.5" />
          </svg>
        ) : (
          <svg className="size-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="2" width="12" height="2" rx="0.5" />
            <rect x="2" y="6" width="12" height="2" rx="0.5" />
            <rect x="2" y="10" width="12" height="2" rx="0.5" />
            <rect x="2" y="14" width="12" height="2" rx="0.5" />
          </svg>
        )}
      </Button>

      {/* Show completed toggle */}
      <Button
        variant="outline"
        size="sm"
        className={cn("gap-1.5", !showCompleted && "text-muted-foreground")}
        onClick={onToggleCompleted}
        title={showCompleted ? "Hide completed tasks" : "Show completed tasks"}
      >
        {showCompleted ? (
          <Eye className="size-3.5" />
        ) : (
          <EyeOff className="size-3.5" />
        )}
        <span className="hidden sm:inline">Completed</span>
      </Button>
    </div>
  );
}
