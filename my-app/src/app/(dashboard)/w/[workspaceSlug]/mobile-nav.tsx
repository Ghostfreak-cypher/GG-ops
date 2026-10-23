"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

/**
 * Below lg the sidebar lives here. The nav itself is passed in as children so the
 * server layout stays a Server Component and this only owns open/close state.
 */
export function MobileNav({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  // The workspace layout is shared by every /w/[slug]/* route, so tapping a link in
  // the drawer never unmounts it — it has to be closed explicitly. Adjusted during
  // render rather than in an effect, which would cascade an extra render.
  const [lastPathname, setLastPathname] = React.useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Open navigation"
        className="-ml-1 inline-flex size-11 shrink-0 items-center justify-center text-foreground lg:hidden"
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent
        side="left"
        title="Navigation"
        className="scrollbar-none gap-4 overflow-y-auto bg-sidebar p-3 text-sidebar-foreground [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </SheetContent>
    </Sheet>
  );
}
