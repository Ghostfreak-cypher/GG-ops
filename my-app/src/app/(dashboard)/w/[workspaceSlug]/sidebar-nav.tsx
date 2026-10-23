"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  CheckSquare,
  Calendar,
  Users,
  UsersRound,
  Inbox,
  Plus,
  Target,
  BarChart2,
  ClipboardList,
  Settings,
  User,
  DollarSign,
  ClipboardCheck,
  ClipboardPen,
  Sparkles,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { canSubmitDsr, canViewAllDsr, canEditTasks } from "@/modules/workspace/server/permissions";
import type { WorkspaceRole } from "@/modules/workspace/roles";
import type { ProjectSummary } from "@/modules/project/server/queries";
import { useSidebar } from "./sidebar-shell";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

type NavItem = { label: string; href: string; icon: LucideIcon; badge?: number };

const linkClass = (active: boolean, collapsed: boolean) =>
  cn(
    "flex items-center gap-2.5 px-3 py-2 pointer-coarse:py-3 font-sans text-xs font-semibold uppercase tracking-widest transition-colors",
    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white",
    active
      ? "bg-white text-black"
      : "text-white/60 hover:bg-sidebar-accent hover:text-white",
    collapsed && "size-9 justify-center px-0",
  );

const sectionHeader =
  "px-3 pb-1 pt-3 font-display text-[10px] uppercase tracking-widest text-white/30";

/**
 * One link, shared by every nav group and the projects list. In rail mode the label
 * becomes sr-only (the accessible name survives) and a tooltip supplies the visible
 * label — wrapped only while collapsed, since toggling a Radix Tooltip's `open` prop
 * between controlled/uncontrolled logs a dev warning.
 */
function NavLink({
  href,
  active,
  icon,
  label,
  badge,
}: {
  href: string;
  active: boolean;
  /** Either a Lucide icon or a pre-sized dot element (projects use a colour swatch). */
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  const { collapsed } = useSidebar();

  const link = (
    <Link href={href} className={linkClass(active, collapsed)}>
      <span className="relative shrink-0">
        {icon}
        {collapsed && badge ? (
          <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-white" />
        ) : null}
      </span>
      <span className={cn("flex-1 truncate", collapsed && "sr-only")}>
        {label}
        {collapsed && badge ? `, ${badge} unread` : ""}
      </span>
      {!collapsed && badge ? (
        <span className="border-2 border-white/40 px-1.5 py-0 font-display text-[10px] text-white/60">
          {badge}
        </span>
      ) : null}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">
        {label}
        {badge ? ` (${badge})` : ""}
      </TooltipContent>
    </Tooltip>
  );
}

function NavSection({
  title,
  items,
  isActive,
}: {
  title: string;
  items: NavItem[];
  isActive: (href: string) => boolean;
}) {
  const { collapsed } = useSidebar();
  return (
    <div className="space-y-0.5">
      {collapsed ? (
        <div className="mx-2 my-1 h-px bg-white/10" />
      ) : (
        <div className={sectionHeader}>{title}</div>
      )}
      <nav className="space-y-0.5">
        {items.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            active={isActive(item.href)}
            icon={<item.icon className="size-4 shrink-0" />}
            label={item.label}
            badge={item.badge}
          />
        ))}
      </nav>
    </div>
  );
}

export function SidebarNav({
  slug,
  unread,
  pendingDrafts,
  projects,
  role,
  financeWorkspaceSlug,
  ggDocsHref,
}: {
  slug: string;
  unread: number;
  /** Pending AI-suggested task drafts waiting on a reviewer. Only shown to roles that can approve them. */
  pendingDrafts: number;
  projects: ProjectSummary[];
  /** The caller's role in this workspace — decides which DSR entries (if any) are shown. */
  role: WorkspaceRole;
  /** Only workspace allowed to see the "Spend Report" link; null disables it everywhere. */
  financeWorkspaceSlug: string | null;
  /** GG-Docs connect link for this workspace; null when GGDOCS_URL is unset. */
  ggDocsHref: string | null;
}) {
  const pathname = usePathname();
  const { collapsed } = useSidebar();
  const base = `/w/${slug}`;

  const items: NavItem[] = [
    { label: "Home", href: base, icon: Home },
    { label: "My Tasks", href: `${base}/my-tasks`, icon: CheckSquare },
    { label: "Calendar", href: `${base}/calendar`, icon: Calendar },
    { label: "Inbox", href: `${base}/inbox`, icon: Inbox, badge: unread },
    // Same gate as approving a draft (canEditTasks) — no point showing a queue you can't act on.
    ...(canEditTasks(role)
      ? [{ label: "Task Drafts", href: `${base}/drafts`, icon: Sparkles, badge: pendingDrafts }]
      : []),
    ...(ggDocsHref ? [{ label: "Open in GG-Docs", href: ggDocsHref, icon: ExternalLink }] : []),
  ];

  const peopleItems: NavItem[] = [
    { label: "Directory", href: `${base}/people`, icon: Users },
    { label: "Teams", href: `${base}/people/teams`, icon: UsersRound },
    { label: "Members", href: `${base}/members`, icon: User },
    // Both render for a maintainer or admin: they file their own report and read the team's.
    ...(canSubmitDsr(role) ? [{ label: "My DSR", href: `${base}/dsr`, icon: ClipboardPen }] : []),
    ...(canViewAllDsr(role)
      ? [{ label: "Team DSR", href: `${base}/dsr/team`, icon: ClipboardCheck }]
      : []),
  ];

  const strategyItems: NavItem[] = [
    { label: "Goals", href: `${base}/strategy/goals`, icon: Target },
    { label: "Reporting", href: `${base}/strategy/reporting`, icon: BarChart2 },
    { label: "Resourcing", href: `${base}/strategy/resourcing`, icon: Users },
    { label: "Module Board", href: `${base}/strategy/module-board`, icon: ClipboardList },
    ...(slug === financeWorkspaceSlug
      ? [{ label: "Spend Report", href: `${base}/spend`, icon: DollarSign }]
      : []),
  ];

  const settingsItems: NavItem[] = [
    { label: "Notifications", href: `${base}/settings/notifications`, icon: Settings },
  ];

  // `${base}/dsr` is a prefix of `${base}/dsr/team`, so it has to match exactly or both DSR
  // entries light up at once — the same reason `base` does.
  const isActive = (href: string) =>
    href === base || href === `${base}/dsr` ? pathname === href : pathname.startsWith(href);

  return (
    <>
      <nav className="space-y-0.5">
        {items.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            active={isActive(item.href)}
            icon={<item.icon className="size-4 shrink-0" />}
            label={item.label}
            badge={item.badge}
          />
        ))}
      </nav>

      <NavSection title="People" items={peopleItems} isActive={isActive} />
      <NavSection title="Strategy" items={strategyItems} isActive={isActive} />
      <NavSection title="Settings" items={settingsItems} isActive={isActive} />

      <div className="space-y-1">
        {collapsed ? (
          <div className="mx-2 my-1 h-px bg-white/10" />
        ) : (
          <div className="flex items-center justify-between px-3">
            <span className={cn(sectionHeader, "px-0")}>Projects</span>
            <Link
              href={`${base}/projects`}
              aria-label="New project"
              className="-mr-2 inline-flex size-7 items-center justify-center text-white/40 transition-colors hover:text-white pointer-coarse:size-11"
            >
              <Plus className="size-3.5" />
            </Link>
          </div>
        )}
        <nav className="space-y-0.5">
          {collapsed && (
            <NavLink
              href={`${base}/projects`}
              active={false}
              icon={<Plus className="size-4 shrink-0" />}
              label="New project"
            />
          )}
          {projects.length === 0 ? (
            collapsed ? null : (
              <Link
                href={`${base}/projects`}
                className="block px-3 py-2 font-sans text-xs uppercase tracking-widest text-white/40 transition-colors hover:text-white"
              >
                New project...
              </Link>
            )
          ) : (
            projects.map((p) => (
              <NavLink
                key={p.id}
                href={`${base}/projects/${p.id}`}
                active={pathname.startsWith(`${base}/projects/${p.id}`)}
                icon={
                  <span
                    className="block size-3 shrink-0"
                    style={{ backgroundColor: p.color ?? "#ffffff" }}
                  />
                }
                label={p.name}
              />
            ))
          )}
        </nav>
      </div>
    </>
  );
}
