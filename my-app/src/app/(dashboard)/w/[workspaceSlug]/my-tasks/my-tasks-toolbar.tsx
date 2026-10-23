"use client";

import { Search, Filter, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { TASK_STATUSES, TASK_PRIORITIES } from "@/modules/task/constants";
import { STATUS_UI, PRIORITY_UI } from "@/lib/task-ui";
import { cn } from "@/lib/utils";
import type { MyTaskFilters, FilterOption } from "./my-tasks-filters";
import { EMPTY_MY_TASK_FILTERS } from "./my-tasks-filters";

interface MyTasksToolbarProps {
  filters: MyTaskFilters;
  onChange: (f: MyTaskFilters) => void;
  projectOptions: FilterOption[];
  labelOptions: FilterOption[];
}

export function MyTasksToolbar({
  filters,
  onChange,
  projectOptions,
  labelOptions,
}: MyTasksToolbarProps) {
  const activeCount =
    filters.statuses.length +
    filters.priorities.length +
    filters.projectIds.length +
    filters.labelIds.length;

  function toggleMulti<T extends string>(
    arr: T[],
    val: T,
    field: keyof MyTaskFilters,
  ) {
    const next = arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
    onChange({ ...filters, [field]: next });
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Search my tasks…"
          className="h-9 pl-8"
        />
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Filter className="size-3.5" />
            Filter
            {activeCount > 0 && (
              <span className="flex size-4 items-center justify-center border-2 border-background bg-foreground text-[10px] font-bold text-background">
                {activeCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="end">
          <div className="space-y-3">
            {/* Status */}
            <FilterGroup label="Status">
              {TASK_STATUSES.map((s) => (
                <Chip
                  key={s}
                  active={filters.statuses.includes(s)}
                  dot={STATUS_UI[s].dot}
                  onClick={() => toggleMulti(filters.statuses, s, "statuses")}
                >
                  {STATUS_UI[s].label}
                </Chip>
              ))}
            </FilterGroup>

            <Separator />

            {/* Priority */}
            <FilterGroup label="Priority">
              {TASK_PRIORITIES.map((p) => (
                <Chip
                  key={p}
                  active={filters.priorities.includes(p)}
                  dot={PRIORITY_UI[p].dot}
                  onClick={() => toggleMulti(filters.priorities, p, "priorities")}
                >
                  {PRIORITY_UI[p].label}
                </Chip>
              ))}
            </FilterGroup>

            {projectOptions.length > 0 && (
              <>
                <Separator />
                <FilterGroup label="Project">
                  {projectOptions.map((p) => (
                    <Chip
                      key={p.id}
                      active={filters.projectIds.includes(p.id)}
                      onClick={() => toggleMulti(filters.projectIds, p.id, "projectIds")}
                    >
                      {p.name}
                    </Chip>
                  ))}
                </FilterGroup>
              </>
            )}

            {labelOptions.length > 0 && (
              <>
                <Separator />
                <FilterGroup label="Label">
                  {labelOptions.map((l) => (
                    <Chip
                      key={l.id}
                      active={filters.labelIds.includes(l.id)}
                      colorDot={l.color}
                      onClick={() => toggleMulti(filters.labelIds, l.id, "labelIds")}
                    >
                      {l.name}
                    </Chip>
                  ))}
                </FilterGroup>
              </>
            )}

            {activeCount > 0 && (
              <>
                <Separator />
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-1.5 border-2 border-border py-1 font-display text-[10px] uppercase tracking-widest transition-colors hover:bg-primary hover:text-primary-foreground"
                  onClick={() =>
                    onChange({ ...EMPTY_MY_TASK_FILTERS, search: filters.search })
                  }
                >
                  <X className="size-3.5" />
                  Clear all filters
                </button>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  active,
  dot,
  colorDot,
  onClick,
  children,
}: {
  active: boolean;
  dot?: string;
  colorDot?: string | null;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 border-2 px-2 py-1 font-display text-[10px] uppercase tracking-widest transition-colors",
        active
          ? "border-border bg-primary text-primary-foreground"
          : "border-border bg-background text-foreground hover:bg-primary hover:text-primary-foreground",
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", dot)} />}
      {colorDot && (
        <span
          className="size-1.5 rounded-full"
          style={{ backgroundColor: colorDot }}
        />
      )}
      {children}
    </button>
  );
}
