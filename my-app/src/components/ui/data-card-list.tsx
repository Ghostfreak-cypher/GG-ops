import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Mobile fallback for the app's dense grid/table surfaces.
 *
 * Below `md` a table row can't show six columns without sideways scrolling, so each
 * row renders as a stacked card instead: a title line, an optional subtitle, a set of
 * label/value pairs, and an actions slot. Tables keep their real markup from `md:` up
 * and simply hide this list.
 *
 * Usage: render `<DataCardList className="md:hidden">` next to the existing table and
 * add `hidden md:block` to the table's wrapper.
 */
export function DataCardList({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>{children}</div>
  );
}

export function DataCard({
  title,
  subtitle,
  leading,
  actions,
  selected = false,
  onClick,
  children,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Avatar, checkbox, or icon shown at the start of the header row. */
  leading?: React.ReactNode;
  actions?: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
  /** `DataCardField`s describing the row's remaining columns. */
  children?: React.ReactNode;
  className?: string;
}) {
  const interactive = typeof onClick === "function";

  return (
    <div
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        "border border-border bg-card p-3 transition-colors",
        selected && "bg-muted/30",
        interactive && "cursor-pointer hover:bg-muted/20",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {leading ? <div className="flex shrink-0 items-center pt-0.5">{leading}</div> : null}
        <div className="min-w-0 flex-1">
          {/* Wrap rather than truncate: the card replaces a table the value was fully
              visible in, so a clipped email or URL loses information the desktop shows. */}
          <div className="line-clamp-2 wrap-anywhere text-sm font-medium text-foreground">
            {title}
          </div>
          {subtitle ? (
            <div className="line-clamp-2 wrap-anywhere text-xs text-muted-foreground">
              {subtitle}
            </div>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
      </div>

      {children ? (
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border pt-3">
          {children}
        </dl>
      ) : null}
    </div>
  );
}

export function DataCardField({
  label,
  children,
  full = false,
}: {
  label: string;
  children: React.ReactNode;
  /** Span both columns — for wide values like a role selector. */
  full?: boolean;
}) {
  return (
    <div className={cn("min-w-0", full && "col-span-2")}>
      <dt className="font-mono text-[10px] uppercase text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 wrap-anywhere text-xs text-foreground">{children}</dd>
    </div>
  );
}
