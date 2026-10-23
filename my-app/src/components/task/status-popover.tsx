"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TASK_STATUSES, type TaskStatus } from "@/modules/task/constants";
import { STATUS_UI } from "@/lib/task-ui";
import { cn } from "@/lib/utils";

interface StatusPopoverProps {
  value: TaskStatus;
  disabled?: boolean;
  onSelect: (status: TaskStatus) => void;
  children: React.ReactNode;
}

export function StatusPopover({ value, disabled, onSelect, children }: StatusPopoverProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1">
        {TASK_STATUSES.map((s) => {
          const ui = STATUS_UI[s];
          return (
            <button
              key={s}
              type="button"
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted",
                s === value && "font-medium",
              )}
              onClick={() => {
                onSelect(s);
                setOpen(false);
              }}
            >
              <span className={cn("size-2 rounded-full", ui.dot)} />
              <span className="flex-1 text-left">{ui.label}</span>
              {s === value && <Check className="size-3.5 text-primary" />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
