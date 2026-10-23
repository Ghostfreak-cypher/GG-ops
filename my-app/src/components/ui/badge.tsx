import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 border-[2px] px-2.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-[1px] leading-none whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-border bg-background text-foreground",
        secondary: "border-border bg-primary text-primary-foreground",
        outline: "border-border bg-background text-foreground",
        destructive: "border-destructive bg-background text-destructive",
        success:
          "border-[#008000] bg-background text-[#008000] dark:border-[#22c55e] dark:text-[#22c55e]",
        warning: "border-[#ffa500] bg-background text-[#ffa500]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { badgeVariants };
