import { Skeleton } from "@/components/ui/skeleton";

export default function ProjectLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-start gap-3 pb-4">
        <Skeleton className="size-10 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-6 w-48 max-w-full" />
          <Skeleton className="h-1.5 w-40 max-w-full" />
          <div className="flex flex-wrap gap-4 pt-1">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-3 w-20" />
            ))}
          </div>
        </div>
        <Skeleton className="hidden h-9 w-36 rounded-lg sm:block" />
      </div>

      {/* Toolbar skeleton — wraps, or the fixed widths total ~650px and overflow a phone */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <Skeleton className="h-8 w-52 max-w-full rounded-md" />
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-md" />
        ))}
      </div>

      {/* Section skeleton */}
      {[1, 2].map((s) => (
        <div key={s} className="overflow-hidden rounded-xl border border-border">
          <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-2">
            <Skeleton className="size-3.5 rounded" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-8 rounded-full" />
          </div>
          {/* Mirrors TASK_GRID: only name + trailing control survive below md. */}
          <div className="divide-y divide-border">
            {[1, 2, 3].map((r) => (
              <div key={r} className="flex items-center gap-3 px-3 py-3">
                <Skeleton className="size-4 rounded" />
                <Skeleton className="size-3.5 rounded-full" />
                <Skeleton className="h-4 max-w-64 flex-1" />
                <Skeleton className="hidden h-5 w-20 rounded-md lg:block" />
                <Skeleton className="hidden h-5 w-16 rounded-md lg:block" />
                <Skeleton className="size-6 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
