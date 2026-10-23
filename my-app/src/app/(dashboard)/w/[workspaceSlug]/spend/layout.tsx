import { notFound } from "next/navigation";
import Link from "next/link";
import { requireFinanceWorkspace } from "@/modules/spend-report/access";

export default async function SpendLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const access = await requireFinanceWorkspace();
  // The feature only ever operates on the single finance workspace — a URL for any
  // other workspace slug has no report data to show.
  if (access.workspace.slug !== workspaceSlug) notFound();

  const base = `/w/${access.workspace.slug}/spend`;

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1 border-b-[3px] border-border">
        <Link
          href={base}
          className="flex min-h-11 items-center px-3 font-sans text-xs font-semibold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
        >
          Reports
        </Link>
        <Link
          href={`${base}/trends`}
          className="flex min-h-11 items-center px-3 font-sans text-xs font-semibold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
        >
          Trends
        </Link>
      </nav>
      {children}
    </div>
  );
}
