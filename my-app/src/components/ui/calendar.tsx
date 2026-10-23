"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "relative",
        month: "space-y-3",
        // Caption row holds the centered "Month Year" label.
        month_caption: "flex h-9 items-center justify-center",
        caption_label: "text-sm font-semibold text-foreground",
        // Nav is absolutely positioned over the caption, arrows pushed to edges.
        nav: "absolute inset-x-0 top-0 z-10 flex h-9 items-center justify-between px-0.5",
        button_previous: cn(
          "inline-flex size-7 pointer-coarse:size-9 items-center justify-center rounded-md text-muted-foreground",
          "transition-colors hover:bg-muted hover:text-foreground",
          "disabled:pointer-events-none disabled:opacity-30",
        ),
        button_next: cn(
          "inline-flex size-7 pointer-coarse:size-9 items-center justify-center rounded-md text-muted-foreground",
          "transition-colors hover:bg-muted hover:text-foreground",
          "disabled:pointer-events-none disabled:opacity-30",
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "w-9 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground",
        week: "mt-1.5 flex w-full",
        day: "relative size-9 p-0 text-center text-sm",
        day_button: cn(
          "inline-flex size-9 items-center justify-center rounded-lg font-normal text-foreground",
          "transition-colors hover:bg-muted",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:pointer-events-none disabled:opacity-30",
        ),
        // State modifier classes land on the cell; target the child button.
        selected:
          "[&>button]:bg-primary [&>button]:font-medium [&>button]:text-primary-foreground [&>button]:hover:bg-primary",
        today:
          "[&>button]:font-semibold [&>button]:ring-1 [&>button]:ring-inset [&>button]:ring-primary/50",
        outside: "[&>button]:text-muted-foreground/40",
        disabled: "[&>button]:opacity-30",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClass }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
          return <Icon className={cn("size-4", chevronClass)} />;
        },
      }}
      {...props}
    />
  );
}
