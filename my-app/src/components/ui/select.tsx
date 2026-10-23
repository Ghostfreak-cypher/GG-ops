import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared field surface, also usable on inputs/textareas that need to match. */
// text-base (16px) below md keeps iOS Safari from zooming the viewport on focus.
export const fieldClass =
  "rounded-md border border-input bg-background text-base md:text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function Select({
  className,
  wrapperClassName,
  children,
  ref,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  ref?: React.Ref<HTMLSelectElement>;
  wrapperClassName?: string;
}) {
  return (
    <div
      className={cn(
        "relative inline-flex w-full items-center",
        wrapperClassName,
      )}
    >
      <select
        ref={ref}
        className={cn(
          fieldClass,
          "h-11 md:h-8 w-full appearance-none py-0 pl-2.5 pr-7",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-muted-foreground" />
    </div>
  );
}
