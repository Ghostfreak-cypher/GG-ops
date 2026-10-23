import { ClipboardList, SearchX } from "lucide-react";

interface EmptyStateProps {
  isFiltered: boolean;
}

export function EmptyState({ isFiltered }: EmptyStateProps) {
  if (isFiltered) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <SearchX className="size-6 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">No tasks match your filters</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Try changing or clearing your search and filter criteria.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <ClipboardList className="size-6 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium">No tasks yet</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Add a task below to get started with this project.
        </p>
      </div>
    </div>
  );
}
