import { Skeleton } from "@/components/ui/skeleton";

export default function TaskDetailLoading() {
  return (
    <div className="mx-auto max-w-5xl">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-3 rounded-full" />
        <Skeleton className="h-4 w-48" />
      </div>

      <div className="flex flex-col gap-8 lg:flex-row lg:gap-10">
        {/* Left: main content */}
        <div className="min-w-0 flex-1 space-y-6">
          {/* Title */}
          <Skeleton className="h-8 w-3/4" />

          {/* Description */}
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <div className="space-y-1.5 rounded-lg bg-muted/40 p-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
            </div>
          </div>

          {/* Subtasks */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="size-4" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-6 rounded-full" />
            </div>
            <div className="overflow-hidden rounded-xl border border-border">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0">
                  <Skeleton className="size-2 rounded-full" />
                  <Skeleton className="h-4 flex-1 max-w-xs" />
                  <Skeleton className="h-5 w-16 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: details sidebar */}
        <div className="w-full lg:w-80 lg:shrink-0">
          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <Skeleton className="h-3 w-16" />
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-20 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
