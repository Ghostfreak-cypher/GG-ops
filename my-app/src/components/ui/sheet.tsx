"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

/**
 * Slide-over panel. Radix Dialog supplies the four things the app's hand-rolled
 * drawers were missing: focus trap, focus restore, body-scroll lock and aria.
 *
 * Enter animation uses `starting:` (@starting-style) rather than `animate-in` —
 * this repo has no tw-animate-css, so the `animate-in` utilities used elsewhere
 * compile to nothing. There is no exit animation: Radix unmounts on close, and
 * keeping the panel mounted to animate it out is what left the old task panel
 * tabbable while invisible.
 */
export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export function SheetContent({
  side = "right",
  title,
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  side?: "left" | "right";
  /** Accessible name for the dialog. Rendered visually hidden — render your own heading too. */
  title: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
      <DialogPrimitive.Content
        aria-describedby={undefined}
        className={cn(
          "fixed inset-y-0 z-50 flex h-dvh w-full flex-col bg-background",
          "transition-transform duration-300 ease-out motion-reduce:transition-none",
          side === "right"
            ? "right-0 max-w-[520px] border-l-[3px] border-border starting:translate-x-full"
            : "left-0 max-w-[min(320px,85vw)] border-r-[3px] border-sidebar-border starting:-translate-x-full",
          "translate-x-0",
          className,
        )}
        {...props}
      >
        <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
        {children}
        {/* A spacer, not padding, so a consumer's p-* can't merge it away. Keeps sheet
            footers clear of the iOS home indicator. */}
        <div aria-hidden className="h-[env(safe-area-inset-bottom)] shrink-0" />
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
