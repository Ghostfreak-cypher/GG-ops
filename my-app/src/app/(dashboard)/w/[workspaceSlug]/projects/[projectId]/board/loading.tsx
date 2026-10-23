import { Skeleton } from "@/components/ui/skeleton";

export default function BoardLoading() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="flex items-start gap-3 pb-4">
        <Skeleton className="size-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-1.5 w-40" />
        </div>
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>

      {/* Board columns */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {[1, 2, 3, 4].map((col) => (
          <div key={col} className="w-72 shrink-0 space-y-3">
            {/* Column header */}
            <div className="flex items-center gap-2">
              <Skeleton className="size-2.5 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-6 rounded-full" />
            </div>
            {/* Cards */}
            {Array.from({ length: col === 1 ? 4 : col === 2 ? 3 : 2 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-3 space-y-2 shadow-sm">
                <Skeleton className="h-4 w-full" />
                {i % 2 === 0 && <Skeleton className="h-3 w-4/5" />}
                <div className="flex items-center justify-between pt-1">
                  <Skeleton className="h-5 w-16 rounded-md" />
                  <div className="flex items-center gap-1.5">
                    <Skeleton className="size-5 rounded-full" />
                    {i % 3 === 0 && <Skeleton className="size-5 rounded-full" />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
