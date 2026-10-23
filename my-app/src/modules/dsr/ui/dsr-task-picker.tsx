"use client";

import { useState } from "react";
import { Link2, X } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { TaskStatus } from "@/modules/task/constants";

/** A task offered by the picker — your own open work, resolved on the server. */
export type LinkableTask = {
  id: string;
  title: string;
  status: TaskStatus;
  projectName: string;
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  DONE: "Done",
  BLOCKED: "Blocked",
};

/**
 * Optional "which task was this?" control for one row of the DSR form.
 *
 * The list is handed down from the server already filtered to the filer's own unfinished
 * tasks, so it's useful the instant it opens — you pick from what you're working on rather
 * than having to remember and retype a title. That also means cmdk can do its own filtering
 * and there's no request per keystroke to race.
 */
export function DsrTaskPicker({
  tasks,
  taskId,
  taskTitle,
  onPick,
  onClear,
}: {
  tasks: LinkableTask[];
  taskId: string | null;
  /** Title of the currently linked task, if it still resolves. */
  taskTitle: string | null;
  onPick: (task: LinkableTask) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);

  if (taskId) {
    return (
      <span className="inline-flex max-w-full items-center gap-1 border-2 border-border px-1.5 py-0.5 text-xs">
        <Link2 className="size-3 shrink-0 text-muted-foreground" />
        <span className="truncate">{taskTitle ?? "Linked task"}</span>
        <button
          type="button"
          onClick={onClear}
          aria-label="Unlink task"
          className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
        >
          <X className="size-3" />
        </button>
      </span>
    );
  }

  // Nothing assigned and open means the picker can only ever show an empty box, so don't
  // offer a control that leads nowhere.
  if (tasks.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <Link2 className="size-3" />
          Link task
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <Command>
          <CommandInput placeholder="Filter your tasks…" />
          <CommandList>
            <CommandEmpty>No matching task.</CommandEmpty>
            {tasks.map((task) => (
              <CommandItem
                key={task.id}
                // Both fields are searchable: people look for a task by its name or by the
                // project it sits in.
                value={`${task.title} ${task.projectName}`}
                onSelect={() => {
                  onPick(task);
                  setOpen(false);
                }}
                className="cursor-pointer"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm">{task.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {task.projectName} · {STATUS_LABEL[task.status]}
                  </p>
                </div>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
