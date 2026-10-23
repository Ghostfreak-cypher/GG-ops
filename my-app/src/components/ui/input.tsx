import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  type,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={cn(
        // text-base (16px) below md stops iOS Safari zooming on focus; md: restores 15px.
        "flex h-11 w-full border-[3px] border-border bg-input px-3 py-2.5 font-mono text-base md:text-[15px] text-foreground placeholder:text-muted-foreground transition-colors hover:bg-muted focus:border-[5px] focus:outline-none disabled:cursor-not-allowed disabled:border-muted disabled:bg-muted disabled:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
