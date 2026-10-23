import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";
import { env } from "@/lib/env";
import { requireUser } from "@/modules/auth/server/session";
import {
  getUserWorkspaces,
  getWorkspaceForUser,
} from "@/modules/workspace/server/queries";
import { listProjects } from "@/modules/project/server/queries";
import { getUnreadCount } from "@/modules/notification/server/queries";
import { countPendingDrafts } from "@/modules/task-draft/server/queries";
import { WorkspaceSwitcher } from "@/modules/workspace/ui/workspace-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { SidebarNav } from "./sidebar-nav";
import { SidebarShell } from "./sidebar-shell";
import { MobileNav } from "./mobile-nav";
import { NotificationRefresh } from "./notification-refresh";
import { Input } from "@/components/ui/input";
import { ToastProvider } from "@/components/ui/toast-provider";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const user = await requireUser();

  const ws = await getWorkspaceForUser(workspaceSlug, user.id);
  if (!ws) notFound();

  const [workspaces, projects, unread, pendingDrafts, cookieStore] = await Promise.all([
    getUserWorkspaces(user.id),
    listProjects(ws.id),
    getUnreadCount(user.id),
    countPendingDrafts(ws.id),
    cookies(),
  ]);
  const sidebarCollapsed = cookieStore.get("ggops-sidebar")?.value === "collapsed";

  // Rendered twice: in the desktop aside and inside the mobile drawer. Keep it free
  // of subscriptions — the realtime one lives in NotificationRefresh, mounted once.
  const sidebar = (
    <>
      <div className="flex items-center gap-2 px-2 pt-1 group-data-[collapsed=true]/sidebar:justify-center group-data-[collapsed=true]/sidebar:px-0">
        <span className="grid size-7 shrink-0 place-items-center border-2 border-white bg-white p-0.5">
          <Image src="/logo-icon.png" alt="GG" width={24} height={24} className="size-full object-contain" />
        </span>
        <span className="font-sans text-sm font-semibold uppercase tracking-wide text-sidebar-foreground group-data-[collapsed=true]/sidebar:hidden">
          GG
        </span>
      </div>
      <div className="group-data-[collapsed=true]/sidebar:hidden">
        <WorkspaceSwitcher workspaces={workspaces} current={ws.slug} />
      </div>
      <SidebarNav
        slug={ws.slug}
        unread={unread}
        pendingDrafts={pendingDrafts}
        projects={projects}
        role={ws.role}
        financeWorkspaceSlug={env.FINANCE_WORKSPACE_SLUG ?? null}
        ggDocsHref={
          env.GGDOCS_URL
            ? `${new URL("/connect/ggops", env.GGDOCS_URL)}?workspace=${encodeURIComponent(ws.slug)}`
            : null
        }
      />
    </>
  );

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:border-[3px] focus:border-border focus:bg-background focus:px-4 focus:py-2"
      >
        Skip to content
      </a>

      <SidebarShell defaultCollapsed={sidebarCollapsed}>{sidebar}</SidebarShell>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-2 border-b-[3px] border-border bg-background px-4 max-lg:sticky max-lg:top-0 max-lg:z-30 md:gap-4 md:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <MobileNav>{sidebar}</MobileNav>
            <span className="truncate font-display text-xs uppercase tracking-widest">
              {ws.name}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2 md:gap-3">
            {/* Below md the input would crowd out the workspace name, so link to the page instead. */}
            <Link
              href={`/w/${ws.slug}/search`}
              aria-label="Search tasks"
              className="inline-flex size-11 items-center justify-center text-foreground md:hidden"
            >
              <Search className="size-4" />
            </Link>
            <form action={`/w/${ws.slug}/search`} className="relative hidden md:block">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                placeholder="Search tasks..."
                className="h-9 w-52 pl-8 pr-3 focus:border-[5px]"
              />
            </form>
            <ThemeToggle />
            <UserMenu
              name={user.name ?? user.email}
              email={user.email}
              image={user.image}
              profileHref={`/w/${ws.slug}/people/${user.id}`}
            />
          </div>
        </header>
        <main id="main" className="flex-1 p-4 md:p-6">{children}</main>
      </div>
      <NotificationRefresh userId={user.id} />
      <ToastProvider userId={user.id} />
    </div>
  );
}
