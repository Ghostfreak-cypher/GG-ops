import { handle } from "@/lib/api/handler";
import { err } from "@/lib/api/response";
import { connectDB } from "@/lib/db";
import { env } from "@/lib/env";
import { Workspace } from "@/models/Workspace";
import { WorkspaceMember } from "@/models/WorkspaceMember";
import { getCurrentUser } from "@/modules/auth/server/session";
import type { RiskStatus } from "@/modules/spend-report/calc";
import { listReportsForExport } from "@/modules/spend-report/server/queries/export-reports";

type Ctx = { params: Promise<{ workspaceSlug: string }> };

const CSV_HEADER =
  "Date,Risk,Gross MTD,Net MTD,Gross Today,Net Today,Credits Remaining,Projected Month-End Gross (run-rate),Projected Month-End Net (run-rate)\r\n";

// Auth is re-derived here (not via requireFinanceWorkspace()) because that helper calls
// redirect()/notFound(), which must be thrown outside a try/catch to produce a real
// redirect/404 — the shared `handle()` wrapper's catch-all would otherwise turn both into
// a 500. Route handlers return `err()` JSON instead, matching the members export route.
export const GET = handle(async (req: Request, ctx: Ctx) => {
  const user = await getCurrentUser();
  if (!user) return err("Unauthorized", 401);

  const { workspaceSlug } = await ctx.params;
  const financeSlug = env.FINANCE_WORKSPACE_SLUG;
  if (!financeSlug || workspaceSlug !== financeSlug) return err("Not found", 404);

  await connectDB();
  const workspace = await Workspace.findOne({ slug: financeSlug }).lean();
  if (!workspace) return err("Not found", 404);

  const membership = await WorkspaceMember.findOne({
    workspaceId: workspace._id,
    userId: user.id,
    status: "ACTIVE",
  }).lean();
  if (!membership) return err("Not found", 404);

  const sp = new URL(req.url).searchParams;
  const reports = await listReportsForExport(String(workspace._id), {
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    service: sp.get("service") ?? undefined,
    risk: (sp.get("risk") ?? undefined) as RiskStatus | undefined,
  });

  const rows = reports
    .map((r) =>
      [
        csvCell(r.date),
        csvCell(r.derived.riskStatus),
        r.spend.grossMtd,
        r.derived.netBillableMtd,
        r.spend.grossToday,
        r.derived.netBillableToday,
        r.credits.remaining,
        r.derived.projectedMonthEndGross,
        r.derived.projectedMonthEndNet,
      ].join(","),
    )
    .join("\r\n");

  return new Response(CSV_HEADER + rows, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="spend-reports-${financeSlug}.csv"`,
    },
  });
});

function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
