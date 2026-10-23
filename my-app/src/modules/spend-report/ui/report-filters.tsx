"use client";

import { useRouter, usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { RISK_STATUSES, type RiskStatus } from "@/modules/spend-report/calc";

type Current = {
  from?: string;
  to?: string;
  service?: string;
  risk?: RiskStatus;
};

const RISK_LABEL: Record<RiskStatus, string> = {
  GREEN: "On track",
  YELLOW: "At risk",
  RED: "Over budget",
};

export function ReportFilters({
  serviceOptions,
  current,
}: {
  serviceOptions: string[];
  current: Current;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function update(patch: Current) {
    const merged = { ...current, ...patch };
    const sp = new URLSearchParams();
    if (merged.from) sp.set("from", merged.from);
    if (merged.to) sp.set("to", merged.to);
    if (merged.service) sp.set("service", merged.service);
    if (merged.risk) sp.set("risk", merged.risk);
    const qs = sp.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const active = current.from || current.to || current.service || current.risk;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="date"
        aria-label="From date"
        value={current.from ?? ""}
        max={current.to}
        onChange={(e) => update({ from: e.target.value || undefined })}
        className="h-8 w-auto py-0 text-xs"
      />
      <span className="text-xs text-muted-foreground">to</span>
      <Input
        type="date"
        aria-label="To date"
        value={current.to ?? ""}
        min={current.from}
        onChange={(e) => update({ to: e.target.value || undefined })}
        className="h-8 w-auto py-0 text-xs"
      />
      <Select
        wrapperClassName="w-auto"
        value={current.service ?? ""}
        onChange={(e) => update({ service: e.target.value || undefined })}
        aria-label="Filter by service"
      >
        <option value="">Service</option>
        {serviceOptions.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </Select>
      <Select
        wrapperClassName="w-auto"
        value={current.risk ?? ""}
        onChange={(e) =>
          update({ risk: (e.target.value || undefined) as RiskStatus | undefined })
        }
        aria-label="Filter by risk status"
      >
        <option value="">Risk</option>
        {RISK_STATUSES.map((status) => (
          <option key={status} value={status}>
            {RISK_LABEL[status]}
          </option>
        ))}
      </Select>
      {active && (
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={() => router.push(pathname)}
        >
          <X className="size-3.5" />
          Clear
        </button>
      )}
    </div>
  );
}
