"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { addDays, format, isSameDay } from "date-fns";
import { X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// This popover is used on every task row (board, list, panel, detail — 6 call sites), so
// react-day-picker was shipping in the initial bundle of every route that renders a task,
// even though `Calendar` never actually mounts until `open` flips true (Radix's
// `PopoverContent` renders nothing while closed — same "never exists in the server-rendered
// HTML on first paint" reasoning `rich-text-editor.tsx`'s own dynamic import documents).
const Calendar = dynamic(() => import("@/components/ui/calendar").then((m) => m.Calendar), {
  ssr: false,
  loading: () => <div className="h-75.5 w-63" />,
});

interface DueDatePopoverProps {
  value: string | null;
  disabled?: boolean;
  onSelect: (date: string | null) => void;
  children: React.ReactNode;
}

const QUICK_OPTIONS: { label: string; getDate: () => Date }[] = [
  { label: "Today", getDate: () => new Date() },
  { label: "Tomorrow", getDate: () => addDays(new Date(), 1) },
  { label: "Next week", getDate: () => addDays(new Date(), 7) },
];

export function DueDatePopover({ value, disabled, onSelect, children }: DueDatePopoverProps) {
  const [open, setOpen] = React.useState(false);
  const selected = value ? new Date(value) : undefined;

  function pick(date: Date | null) {
    onSelect(date ? format(date, "yyyy-MM-dd") : null);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-auto overflow-hidden rounded-xl p-0" align="start">
        {/* Quick options */}
        <div className="flex flex-col gap-0.5 p-2">
          {QUICK_OPTIONS.map((opt) => {
            const date = opt.getDate();
            const active = selected && isSameDay(selected, date);
            return (
              <button
                key={opt.label}
                type="button"
                onClick={() => pick(date)}
                className={cn(
                  "flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                  "hover:bg-muted",
                  active ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                <span>{opt.label}</span>
                <span className="text-xs text-muted-foreground">
                  {format(date, "EEE, MMM d")}
                </span>
              </button>
            );
          })}
        </div>

        <div className="border-t border-border" />

        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(day) => pick(day ?? null)}
        />

        {value && (
          <div className="border-t border-border p-2">
            <button
              type="button"
              className="flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              onClick={() => pick(null)}
            >
              <X className="size-3.5" />
              Clear due date
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
