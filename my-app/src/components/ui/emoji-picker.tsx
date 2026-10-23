"use client";

import * as React from "react";
import { EmojiPicker as Frimousse } from "frimousse";
import { Smile } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface EmojiPickerProps {
  /** Called with the chosen emoji character. */
  onEmojiSelect: (emoji: string) => void;
  disabled?: boolean;
  /** Class for the trigger button (defaults to the icon-button style used in toolbars). */
  triggerClassName?: string;
  title?: string;
}

/** A full searchable emoji picker (frimousse) inside a popover, triggered by a Smile icon. */
export function EmojiPicker({
  onEmojiSelect,
  disabled,
  triggerClassName,
  title = "Add emoji",
}: EmojiPickerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          disabled={disabled}
          title={title}
          aria-label={title}
          className={cn(
            "flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40",
            triggerClassName,
          )}
        >
          <Smile className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" sideOffset={6}>
        <Frimousse.Root
          onEmojiSelect={({ emoji }) => {
            onEmojiSelect(emoji);
            setOpen(false);
          }}
          className="isolate flex h-[320px] w-[300px] flex-col bg-popover text-popover-foreground"
        >
          <Frimousse.Search
            placeholder="Search emoji…"
            className="z-10 mx-2 mt-2 appearance-none rounded-md border border-border bg-muted px-2.5 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          <Frimousse.Viewport className="relative flex-1 outline-none">
            <Frimousse.Loading className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              Loading…
            </Frimousse.Loading>
            <Frimousse.Empty className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              No emoji found.
            </Frimousse.Empty>
            <Frimousse.List
              className="select-none pb-1.5"
              components={{
                CategoryHeader: ({ category, ...props }) => (
                  <div
                    className="bg-popover px-3 pb-1.5 pt-3 text-xs font-medium text-muted-foreground"
                    {...props}
                  >
                    {category.label}
                  </div>
                ),
                Row: ({ children, ...props }) => (
                  <div className="scroll-my-1.5 px-1.5" {...props}>
                    {children}
                  </div>
                ),
                Emoji: ({ emoji, ...props }) => (
                  <button
                    className={cn(
                      "flex size-8 items-center justify-center rounded-md text-lg transition-colors",
                      emoji.isActive && "bg-muted",
                    )}
                    {...props}
                  >
                    {emoji.emoji}
                  </button>
                ),
              }}
            />
          </Frimousse.Viewport>
        </Frimousse.Root>
      </PopoverContent>
    </Popover>
  );
}
