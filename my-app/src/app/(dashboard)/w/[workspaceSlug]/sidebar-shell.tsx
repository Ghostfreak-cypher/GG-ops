"use client";

import * as React from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

const COOKIE_NAME = "ggops-sidebar";

type SidebarContextValue = { collapsed: boolean };

const SidebarContext = React.createContext<SidebarContextValue>({ collapsed: false });

/** Read from `SidebarNav` to switch between full labels and the icon-only rail. */
export function useSidebar() {
  return React.useContext(SidebarContext);
}

function writeCookie(collapsed: boolean) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_NAME}=${collapsed ? "collapsed" : "expanded"}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

/**
 * Desktop sidebar with a persisted collapsed/expanded rail state. The toggle lives
 * inside the <aside> itself (not the header) so this component only ever wraps the
 * aside — the mobile drawer renders the same `sidebar` JSX from the layout but stays
 * outside this provider entirely, so it always shows full labels with no extra code.
 */
export function SidebarShell({
  defaultCollapsed,
  children,
}: {
  defaultCollapsed: boolean;
  children: React.ReactNode;
}) {
  // Seeded only from the server-rendered prop — never from document.cookie during
  // render, which would differ between server and client and cause a hydration
  // mismatch.
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      writeCookie(next);
      return next;
    });
  }

  return (
    <SidebarContext value={{ collapsed }}>
      <aside
        data-collapsed={collapsed ? "true" : "false"}
        className={
          "group/sidebar sticky top-0 hidden max-h-dvh shrink-0 flex-col overflow-y-auto " +
          "scrollbar-none [&::-webkit-scrollbar]:hidden border-r-[3px] border-sidebar-border " +
          "bg-sidebar text-sidebar-foreground transition-[width] lg:flex " +
          (collapsed ? "w-14 gap-2 p-2" : "w-60 gap-4 p-3")
        }
      >
        {children}
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={
            "mt-auto flex shrink-0 items-center gap-2.5 px-3 py-2 font-sans text-xs " +
            "font-semibold uppercase tracking-widest text-white/60 transition-colors " +
            "hover:bg-sidebar-accent hover:text-white " +
            "focus-visible:outline-2 focus-visible:-outline-offset-2 " +
            (collapsed ? "justify-center px-0 size-9 self-center" : "")
          }
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4 shrink-0" />
          ) : (
            <>
              <PanelLeftClose className="size-4 shrink-0" />
              <span className="flex-1 truncate text-left">Collapse</span>
            </>
          )}
        </button>
      </aside>
    </SidebarContext>
  );
}
