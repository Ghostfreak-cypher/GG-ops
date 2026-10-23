"use client";

import { useRouter, usePathname } from "next/navigation";
import { X } from "lucide-react";
import { TASK_STATUSES, TASK_PRIORITIES } from "@/modules/task/constants";
import { STATUS_UI, PRIORITY_UI } from "@/lib/task-ui";
import { Select } from "@/components/ui/select";

type Current = { status?: string; priority?: string; assigneeId?: string; labelId?: string };

export function FilterBar({
  members,
  labels,
  current,
}: {
  members: { id: string; name: string }[];
  labels: { id: string; name: string }[];
  current: Current;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function update(patch: Current) {
    const merged = { ...current, ...patch };
    const sp = new URLSearchParams();
    if (merged.status) sp.set("status", merged.status);
    if (merged.priority) sp.set("priority", merged.priority);
    if (merged.assigneeId) sp.set("assignee", merged.assigneeId);
    if (merged.labelId) sp.set("label", merged.labelId);
    const qs = sp.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const active =
    current.status || current.priority || current.assigneeId || current.labelId;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        wrapperClassName="w-auto"
        value={current.status ?? ""}
        onChange={(e) => update({ status: e.target.value })}
        aria-label="Filter by status"
      >
        <option value="">Status</option>
        {TASK_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_UI[s].label}
          </option>
        ))}
      </Select>
      <Select
        wrapperClassName="w-auto"
        value={current.priority ?? ""}
        onChange={(e) => update({ priority: e.target.value })}
        aria-label="Filter by priority"
      >
        <option value="">Priority</option>
        {TASK_PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {PRIORITY_UI[p].label}
          </option>
        ))}
      </Select>
      <Select
        wrapperClassName="w-auto"
        value={current.assigneeId ?? ""}
        onChange={(e) => update({ assigneeId: e.target.value })}
        aria-label="Filter by assignee"
      >
        <option value="">Assignee</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </Select>
      <Select
        wrapperClassName="w-auto"
        value={current.labelId ?? ""}
        onChange={(e) => update({ labelId: e.target.value })}
        aria-label="Filter by label"
      >
        <option value="">Label</option>
        {labels.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </Select>
      {active && (
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={() => router.push(pathname)}
        >
          <X className="size-3.5" />
          Clear
        </button>
      )}
    </div>
  );
}
