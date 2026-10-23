import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DerivedMetrics } from "@/modules/spend-report/calc";
import type { SpendReportDTO } from "@/modules/spend-report/server/dto";

const RISK_BADGE: Record<DerivedMetrics["riskStatus"], { variant: "success" | "warning" | "destructive"; icon: string }> = {
  GREEN: { variant: "success", icon: "🟢" },
  YELLOW: { variant: "warning", icon: "🟡" },
  RED: { variant: "destructive", icon: "🔴" },
};

function money(value: number | null | undefined): string {
  return value == null ? "—" : `$${value.toFixed(2)}`;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function dateOnly(value: string | null): string {
  return value ? value.slice(0, 10) : "—";
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="font-display text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="font-mono text-sm wrap-anywhere">{value}</p>
    </div>
  );
}

export function ReportView({ dto }: { dto: SpendReportDTO }) {
  const { derived } = dto;
  const risk = RISK_BADGE[derived.riskStatus];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Guardrails</CardTitle>
          <Badge variant={risk.variant}>
            {risk.icon} {derived.riskStatus}
          </Badge>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Monthly gross budget" value={money(dto.guardrails.monthlyGrossBudget)} />
          <Stat label="Actual alert status" value={dto.guardrails.actualAlertStatus ?? "—"} />
          <Stat label="Forecast alert status" value={dto.guardrails.forecastAlertStatus ?? "—"} />
          <Stat label="New charge threshold" value={money(dto.guardrails.newChargeThreshold)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Credit position</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Program" value={dto.credits.program || "—"} />
          <Stat label="Credit ID" value={dto.credits.creditId || "—"} />
          <Stat label="Expiry date" value={dateOnly(dto.credits.expiryDate)} />
          <Stat label="Services eligible" value={dto.credits.servicesEligible || "—"} />
          <Stat label="Remaining" value={money(dto.credits.remaining)} />
          <Stat label="Used MTD" value={money(dto.credits.usedMtd)} />
          <Stat label="Allowed daily burn (projected, run-rate)" value={money(derived.allowedDailyBurn)} />
          <Stat
            label="Runway days (projected, run-rate)"
            value={derived.runwayDays == null ? "—" : derived.runwayDays.toFixed(1)}
          />
          <Stat
            label="Projected exhaustion date (projected, run-rate)"
            value={dateOnly(derived.projectedExhaustionDate)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Spend summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Gross MTD" value={money(dto.spend.grossMtd)} />
          <Stat label="Gross today" value={money(dto.spend.grossToday)} />
          <Stat label="Net billable MTD" value={money(derived.netBillableMtd)} />
          <Stat label="Net billable today" value={money(derived.netBillableToday)} />
          <Stat label="Non-credit eligible MTD" value={money(dto.spend.nonCreditEligibleMtd)} />
          <Stat label="Marketplace charges MTD" value={money(dto.spend.marketplaceChargesMtd)} />
          <Stat label="Avg daily gross burn" value={money(derived.avgDailyGrossBurn)} />
          <Stat
            label={
              derived.priorComparisonDate
                ? `Change vs. ${derived.priorComparisonDate}`
                : "Change vs. prior report"
            }
            value={derived.grossChangeVsPrior == null ? "—" : money(derived.grossChangeVsPrior)}
          />
          <Stat label="Month-end gross (projected, run-rate)" value={money(derived.projectedMonthEndGross)} />
          <Stat label="Month-end net (projected, run-rate)" value={money(derived.projectedMonthEndNet)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top 10 services by MTD spend</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <ServiceTable
            services={derived.topServicesByMtd}
            columns={["name", "mtdGross", "today", "pctOfMtdTotal", "increaseVsPrior"]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top 5 services by increase vs. prior</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <ServiceTable
            services={derived.topServicesByIncrease}
            columns={["name", "increaseVsPrior", "mtdGross"]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="AWS account" value={dto.metadata.awsAccount || "—"} />
          <Stat label="Member accounts" value={dto.metadata.memberAccounts || "—"} />
          <Stat label="Regions" value={dto.metadata.regions || "—"} />
          <Stat label="Environments" value={dto.metadata.environments || "—"} />
          <Stat label="Data refreshed at" value={dto.metadata.dataRefreshedAt ?? "—"} />
          <Stat label="Report pulled at" value={dto.metadata.reportPulledAt ?? "—"} />
          <Stat label="Pulled by" value={dto.metadata.pulledBy || "—"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Stat label="Anomalies" value={dto.notes.anomalies || "—"} />
          <Stat label="Actions taken" value={dto.notes.actionsTaken || "—"} />
          <Stat label="Actions needed" value={dto.notes.actionsNeeded || "—"} />
          <Stat label="New charge categories" value={dto.notes.newChargeCategories || "—"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Signoff</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Stat label="Sent to" value={dto.signoff.sentTo || "—"} />
          <Stat label="CC" value={dto.signoff.cc || "—"} />
          <Stat label="Console timestamp" value={dto.signoff.consoleTimestamp ?? "—"} />
        </CardContent>
      </Card>
    </div>
  );
}

type ServiceColumn = "name" | "mtdGross" | "today" | "pctOfMtdTotal" | "increaseVsPrior";

const COLUMN_LABEL: Record<ServiceColumn, string> = {
  name: "Service",
  mtdGross: "MTD gross",
  today: "Today",
  pctOfMtdTotal: "% of MTD total",
  increaseVsPrior: "Increase vs. prior",
};

function ServiceTable({
  services,
  columns,
}: {
  services: DerivedMetrics["topServicesByMtd"];
  columns: ServiceColumn[];
}) {
  if (services.length === 0) {
    return <p className="font-mono text-sm text-muted-foreground">No services recorded.</p>;
  }

  return (
    <table className="w-full min-w-[480px] border-collapse font-mono text-sm">
      <thead>
        <tr className="border-b-[3px] border-border text-left">
          {columns.map((col) => (
            <th key={col} className="px-2 py-2 font-display text-xs uppercase tracking-widest">
              {COLUMN_LABEL[col]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {services.map((service) => (
          <tr key={service.name} className="border-b border-border">
            {columns.map((col) => (
              <td key={col} className="px-2 py-2">
                {col === "name" && service.name}
                {col === "mtdGross" && money(service.mtdGross)}
                {col === "today" && money(service.today)}
                {col === "pctOfMtdTotal" && pct(service.pctOfMtdTotal)}
                {col === "increaseVsPrior" &&
                  (service.increaseVsPrior == null ? "—" : money(service.increaseVsPrior))}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
