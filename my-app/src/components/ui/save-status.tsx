"use client";

import { Check, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type SaveState = "idle" | "saving" | "saved" | "error";

/** A subtle inline "Saving… / Saved ✓ / Couldn't save" indicator. */
export function SaveStatus({ state, className }: { state: SaveState; className?: string }) {
  if (state === "idle") return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-medium",
        state === "error" ? "text-destructive" : "text-muted-foreground",
        className,
      )}
    >
      {state === "saving" && (
        <>
          <Loader2 className="size-3 animate-spin" /> Saving…
        </>
      )}
      {state === "saved" && (
        <>
          <Check className="size-3 text-emerald-500" /> Saved
        </>
      )}
      {state === "error" && (
        <>
          <AlertCircle className="size-3" /> Couldn&apos;t save
        </>
      )}
    </span>
  );
}
