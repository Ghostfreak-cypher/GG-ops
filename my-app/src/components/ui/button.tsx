import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 font-sans text-sm font-semibold uppercase tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:pointer-events-none",
  {
    variants: {
      variant: {
        default:
          "border-[3px] border-border bg-primary text-primary-foreground hover:bg-background hover:text-foreground active:border-[5px] disabled:border-muted disabled:bg-muted disabled:text-muted-foreground",
        secondary:
          "border-[3px] border-border bg-background text-foreground hover:bg-primary hover:text-primary-foreground disabled:border-muted disabled:bg-muted disabled:text-muted-foreground",
        outline:
          "border-[3px] border-border bg-background text-foreground hover:bg-primary hover:text-primary-foreground disabled:border-muted disabled:bg-muted disabled:text-muted-foreground",
        ghost:
          "border-0 bg-transparent text-foreground underline underline-offset-2 hover:text-[#0000ff] dark:hover:text-[#6699ff] disabled:text-muted-foreground",
        destructive:
          "border-[3px] border-border bg-destructive text-destructive-foreground hover:bg-primary hover:text-destructive disabled:border-muted disabled:bg-muted disabled:text-muted-foreground",
      },
      size: {
        // The dense sizes grow on touch devices only — 32/28px is under the 44px
        // minimum, and pointer-coarse leaves every mouse-driven layout untouched.
        default: "h-11 px-6 py-2.5",
        sm: "h-8 pointer-coarse:h-11 px-4 text-xs",
        xs: "h-7 pointer-coarse:h-10 gap-1.5 px-3 text-xs",
        lg: "h-14 px-10 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size, className }))} {...props} />
  );
}

export { buttonVariants };
