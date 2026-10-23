"use client";

import * as React from "react";
import { X, CheckCircle2, Zap, UserCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { bulkUpdateTasksAction, bulkArchiveTasksAction } from "@/modules/task/server/actions/bulk-update-tasks";
import { TASK_STATUSES, TASK_PRIORITIES } from "@/modules/task/constants";
import { STATUS_UI, PRIORITY_UI } from "@/lib/task-ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Member = { id: string; name: string };

interface BulkActionBarProps {
  selectedIds: string[];
  members: Member[];
  onClear: () => void;
  onBulkSuccess: (taskIds: string[], patch: Record<string, unknown>) => void;
  onBulkArchive: (taskIds: string[]) => void;
}

export function BulkActionBar({
  selectedIds,
  members,
  onClear,
  onBulkSuccess,
  onBulkArchive,
}: BulkActionBarProps) {
  const [pending, start] = React.useTransition();
  const count = selectedIds.length;

  if (count === 0) return null;

  async function handleBulkUpdate(patch: Record<string, unknown>) {
    start(async () => {
      const res = await bulkUpdateTasksAction(selectedIds, patch);
      if (res.ok) {
        onBulkSuccess(selectedIds, patch);
        toast.success(`Updated ${count} task${count === 1 ? "" : "s"}`);
      } else {
        toast.error(res.error ?? "Bulk update failed");
      }
    });
  }

  async function handleBulkArchive() {
    start(async () => {
      const res = await bulkArchiveTasksAction(selectedIds);
      if (res.ok) {
        onBulkArchive(selectedIds);
        toast.success(`Archived ${count} task${count === 1 ? "" : "s"}`);
        onClear();
      } else {
        toast.error(res.error ?? "Archive failed");
      }
    });
  }

  return (
    // z-30 keeps it under the task drawer (z-40); it used to be z-50 and covered it.
    // Full-width minus a gutter on phones — centred it overflowed both edges — and
    // padded clear of the iOS home indicator, which viewportFit:"cover" exposes.
    <div className="fixed inset-x-2 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 sm:inset-x-auto sm:left-1/2 sm:bottom-6 sm:-translate-x-1/2">
      <div
        className={cn(
          "flex flex-wrap items-center justify-center gap-2 rounded-xl border border-border bg-popover px-3 py-2 shadow-pop",
          pending && "opacity-70",
        )}
      >
        {/* Count */}
        <span className="text-center text-sm font-medium sm:min-w-20">
          {count} selected
        </span>

        <div className="h-5 w-px bg-border" />

        {/* Set status */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={pending}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 pointer-coarse:min-h-11 pointer-coarse:min-w-11 justify-center text-sm transition-colors hover:bg-muted disabled:pointer-events-none"
            >
              <CheckCircle2 className="size-4" />
              <span className="sr-only sm:not-sr-only">Status</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" side="top">
            <DropdownMenuLabel>Set status</DropdownMenuLabel>
            {TASK_STATUSES.map((s) => (
              <DropdownMenuItem
                key={s}
                className="gap-2"
                onClick={() => handleBulkUpdate({ status: s })}
              >
                <span className={cn("size-2 rounded-full", STATUS_UI[s].dot)} />
                {STATUS_UI[s].label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Set priority */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={pending}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 pointer-coarse:min-h-11 pointer-coarse:min-w-11 justify-center text-sm transition-colors hover:bg-muted disabled:pointer-events-none"
            >
              <Zap className="size-4" />
              <span className="sr-only sm:not-sr-only">Priority</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" side="top">
            <DropdownMenuLabel>Set priority</DropdownMenuLabel>
            {TASK_PRIORITIES.map((p) => (
              <DropdownMenuItem
                key={p}
                className="gap-2"
                onClick={() => handleBulkUpdate({ priority: p })}
              >
                <span className={cn("size-2 rounded-full", PRIORITY_UI[p].dot)} />
                {PRIORITY_UI[p].label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Assign to */}
        {members.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={pending}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 pointer-coarse:min-h-11 pointer-coarse:min-w-11 justify-center text-sm transition-colors hover:bg-muted disabled:pointer-events-none"
              >
                <UserCheck className="size-4" />
                <span className="sr-only sm:not-sr-only">Assign</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top">
              <DropdownMenuLabel>Assign to</DropdownMenuLabel>
              {members.slice(0, 10).map((m) => (
                <DropdownMenuItem
                  key={m.id}
                  onClick={() => handleBulkUpdate({ assigneeIds: [m.id] })}
                >
                  {m.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleBulkUpdate({ assigneeIds: [] })}>
                Clear assignees
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div className="h-5 w-px bg-border" />

        {/* Archive */}
        <button
          type="button"
          disabled={pending}
          onClick={handleBulkArchive}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 pointer-coarse:min-h-11 pointer-coarse:min-w-11 justify-center text-sm text-destructive transition-colors hover:bg-destructive/10 disabled:pointer-events-none"
        >
          <Trash2 className="size-4" />
          <span className="sr-only sm:not-sr-only">Archive</span>
        </button>

        {/* Clear selection */}
        <button
          type="button"
          onClick={onClear}
          className="flex size-7 pointer-coarse:size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Clear selection"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
