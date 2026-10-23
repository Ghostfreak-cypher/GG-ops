import { Skeleton } from "@/components/ui/skeleton";

export default function TimelineLoading() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3 pb-4">
        <Skeleton className="size-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-1.5 w-40" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      {/* Zoom bar */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-32 rounded-md" />
        <Skeleton className="h-4 w-40" />
      </div>
      {/* Gantt skeleton */}
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="flex">
          <div className="hidden w-48 shrink-0 border-r border-border md:block">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="border-b border-border px-3 py-3">
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
          <div className="flex-1 overflow-hidden">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="border-b border-border px-4 py-3">
                <Skeleton className="h-6 rounded" style={{ width: `${30 + (i * 15) % 50}%`, marginLeft: `${(i * 8) % 30}%` }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
