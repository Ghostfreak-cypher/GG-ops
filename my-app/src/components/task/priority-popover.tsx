"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TASK_PRIORITIES, type TaskPriority } from "@/modules/task/constants";
import { PRIORITY_UI } from "@/lib/task-ui";
import { cn } from "@/lib/utils";

interface PriorityPopoverProps {
  value: TaskPriority;
  disabled?: boolean;
  onSelect: (priority: TaskPriority) => void;
  children: React.ReactNode;
}

export function PriorityPopover({ value, disabled, onSelect, children }: PriorityPopoverProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-40 p-1">
        {TASK_PRIORITIES.map((p) => {
          const ui = PRIORITY_UI[p];
          return (
            <button
              key={p}
              type="button"
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted",
                p === value && "font-medium",
              )}
              onClick={() => {
                onSelect(p);
                setOpen(false);
              }}
            >
              <span className={cn("size-2 rounded-full", ui.dot)} />
              <span className="flex-1 text-left">{ui.label}</span>
              {p === value && <Check className="size-3.5 text-primary" />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
