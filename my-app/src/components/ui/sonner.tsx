"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      // viewportFit:"cover" puts the page under the home indicator; pad it back.
      mobileOffset={{
        bottom: "calc(1rem + env(safe-area-inset-bottom))",
        left: "1rem",
        right: "1rem",
      }}
      toastOptions={{
        classNames: {
          toast:
            "group rounded-xl border border-border bg-popover text-popover-foreground shadow-pop text-sm",
          description: "text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-muted text-muted-foreground",
          error: "border-destructive/30 bg-destructive/10 text-destructive",
          success: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
        },
      }}
    />
  );
}
