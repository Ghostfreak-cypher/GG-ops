"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { differenceInCalendarDays, getDate, getDaysInMonth, parseISO } from "date-fns";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { computeDerived, type DerivedMetrics, type MonthContext } from "@/modules/spend-report/calc";
import type { SpendReportInput, SpendServiceInput } from "@/modules/spend-report/schemas";
import type { SpendReportDTO } from "@/modules/spend-report/server/dto";
import type { ActionResult } from "@/lib/action-result";

export type ReportFormProps = {
  defaultValues: SpendReportInput;
  prior: SpendReportInput | null;
  derived: DerivedMetrics;
  onSubmit: (input: SpendReportInput) => Promise<ActionResult<SpendReportDTO>>;
};

const textareaClass =
  "flex min-h-20 w-full resize-y border-[3px] border-border bg-input px-3 py-2.5 font-mono text-base md:text-[15px] text-foreground placeholder:text-muted-foreground transition-colors hover:bg-muted focus:border-[5px] focus:outline-none";

/** Same date math as the server's buildMonthContext — duplicated so this component stays client-only. */
function buildMonthContext(date: string, expiryDate: string | null): MonthContext {
  const parsed = parseISO(date);
  const daysElapsed = getDate(parsed);
  const daysInMonth = getDaysInMonth(parsed);
  return {
    today: date,
    daysElapsed,
    daysInMonth,
    daysRemaining: daysInMonth - daysElapsed,
    daysToCreditExpiry: expiryDate ? differenceInCalendarDays(parseISO(expiryDate), parsed) : null,
  };
}

function toDateInputValue(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

function toDateTimeInputValue(value: string | null): string {
  return value ? value.slice(0, 16) : "";
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        type="number"
        step="0.01"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(e.target.valueAsNumber || 0)}
      />
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function ReportForm({ defaultValues, prior, onSubmit }: ReportFormProps) {
  const [form, setForm] = useState<SpendReportInput>(defaultValues);

  const derived = useMemo(() => {
    const ctx = buildMonthContext(form.date, form.credits.expiryDate);
    return computeDerived(form, prior, ctx);
  }, [form, prior]);

  const mutation = useMutation({
    mutationFn: () => onSubmit(form),
    onSuccess: (result) => {
      if (result.ok) toast.success("Report saved");
      else toast.error(result.error);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to save report"),
  });

  function updateService(index: number, patch: Partial<SpendServiceInput>) {
    setForm((prev) => ({
      ...prev,
      services: prev.services.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  }

  function addService() {
    setForm((prev) => ({
      ...prev,
      services: [...prev.services, { name: "", mtdGross: 0, today: 0 }],
    }));
  }

  function removeService(index: number) {
    setForm((prev) => ({ ...prev, services: prev.services.filter((_, i) => i !== index) }));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="space-y-6"
    >
      <RiskPreview derived={derived} />

      <Card>
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          <TextField
            label="AWS account"
            value={form.metadata.awsAccount}
            onChange={(v) => setForm((p) => ({ ...p, metadata: { ...p.metadata, awsAccount: v } }))}
          />
          <TextField
            label="Member accounts"
            value={form.metadata.memberAccounts}
            onChange={(v) => setForm((p) => ({ ...p, metadata: { ...p.metadata, memberAccounts: v } }))}
          />
          <TextField
            label="Regions"
            value={form.metadata.regions}
            onChange={(v) => setForm((p) => ({ ...p, metadata: { ...p.metadata, regions: v } }))}
          />
          <TextField
            label="Environments"
            value={form.metadata.environments}
            onChange={(v) => setForm((p) => ({ ...p, metadata: { ...p.metadata, environments: v } }))}
          />
          <TextField
            label="Data refreshed at"
            type="datetime-local"
            value={toDateTimeInputValue(form.metadata.dataRefreshedAt)}
            onChange={(v) =>
              setForm((p) => ({ ...p, metadata: { ...p.metadata, dataRefreshedAt: v || null } }))
            }
          />
          <TextField
            label="Report pulled at"
            type="datetime-local"
            value={toDateTimeInputValue(form.metadata.reportPulledAt)}
            onChange={(v) =>
              setForm((p) => ({ ...p, metadata: { ...p.metadata, reportPulledAt: v || null } }))
            }
          />
          <TextField
            label="Pulled by"
            value={form.metadata.pulledBy}
            onChange={(v) => setForm((p) => ({ ...p, metadata: { ...p.metadata, pulledBy: v } }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Credits</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          <TextField
            label="Program"
            value={form.credits.program}
            onChange={(v) => setForm((p) => ({ ...p, credits: { ...p.credits, program: v } }))}
          />
          <TextField
            label="Credit ID"
            value={form.credits.creditId}
            onChange={(v) => setForm((p) => ({ ...p, credits: { ...p.credits, creditId: v } }))}
          />
          <TextField
            label="Expiry date"
            type="date"
            value={toDateInputValue(form.credits.expiryDate)}
            onChange={(v) => setForm((p) => ({ ...p, credits: { ...p.credits, expiryDate: v || null } }))}
          />
          <TextField
            label="Services eligible"
            value={form.credits.servicesEligible}
            onChange={(v) =>
              setForm((p) => ({ ...p, credits: { ...p.credits, servicesEligible: v } }))
            }
          />
          <NumberField
            label="Remaining"
            value={form.credits.remaining}
            onChange={(v) => setForm((p) => ({ ...p, credits: { ...p.credits, remaining: v } }))}
          />
          <NumberField
            label="Used MTD"
            value={form.credits.usedMtd}
            onChange={(v) => setForm((p) => ({ ...p, credits: { ...p.credits, usedMtd: v } }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Spend</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          <NumberField
            label="Gross MTD"
            value={form.spend.grossMtd}
            onChange={(v) => setForm((p) => ({ ...p, spend: { ...p.spend, grossMtd: v } }))}
          />
          <NumberField
            label="Gross today"
            value={form.spend.grossToday}
            onChange={(v) => setForm((p) => ({ ...p, spend: { ...p.spend, grossToday: v } }))}
          />
          <NumberField
            label="Credits applied MTD"
            value={form.spend.creditsAppliedMtd}
            onChange={(v) => setForm((p) => ({ ...p, spend: { ...p.spend, creditsAppliedMtd: v } }))}
          />
          <NumberField
            label="Credits applied today"
            value={form.spend.creditsAppliedToday}
            onChange={(v) => setForm((p) => ({ ...p, spend: { ...p.spend, creditsAppliedToday: v } }))}
          />
          <NumberField
            label="Non-credit eligible MTD"
            value={form.spend.nonCreditEligibleMtd}
            onChange={(v) => setForm((p) => ({ ...p, spend: { ...p.spend, nonCreditEligibleMtd: v } }))}
          />
          <NumberField
            label="Marketplace charges MTD"
            value={form.spend.marketplaceChargesMtd}
            onChange={(v) =>
              setForm((p) => ({ ...p, spend: { ...p.spend, marketplaceChargesMtd: v } }))
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Services</CardTitle>
          <Button type="button" variant="outline" size="xs" onClick={addService}>
            <Plus className="size-3.5" /> Add service
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {form.services.length === 0 && (
            <p className="font-mono text-sm text-muted-foreground">No services added yet.</p>
          )}
          {form.services.map((service, index) => (
            <div key={index} className="flex flex-wrap items-end gap-3 border-[3px] border-border p-3">
              <div className="w-full sm:w-auto sm:flex-1">
                <TextField
                  label="Name"
                  value={service.name}
                  onChange={(v) => updateService(index, { name: v })}
                />
              </div>
              <div className="min-w-0 flex-1 sm:w-36 sm:flex-none">
                <NumberField
                  label="MTD gross"
                  value={service.mtdGross}
                  onChange={(v) => updateService(index, { mtdGross: v })}
                />
              </div>
              <div className="min-w-0 flex-1 sm:w-36 sm:flex-none">
                <NumberField
                  label="Today"
                  value={service.today}
                  onChange={(v) => updateService(index, { today: v })}
                />
              </div>
              <Button
                type="button"
                variant="destructive"
                size="icon"
                onClick={() => removeService(index)}
                aria-label="Remove service"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Guardrails</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          <NumberField
            label="Monthly gross budget"
            value={form.guardrails.monthlyGrossBudget ?? 0}
            onChange={(v) =>
              setForm((p) => ({ ...p, guardrails: { ...p.guardrails, monthlyGrossBudget: v } }))
            }
          />
          <div>
            <Label>Actual alert status</Label>
            <Select
              value={form.guardrails.actualAlertStatus ?? ""}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  guardrails: {
                    ...p.guardrails,
                    actualAlertStatus: e.target.value === "" ? null : (e.target.value as "OK" | "ALERT"),
                  },
                }))
              }
            >
              <option value="">—</option>
              <option value="OK">OK</option>
              <option value="ALERT">ALERT</option>
            </Select>
          </div>
          <div>
            <Label>Forecast alert status</Label>
            <Select
              value={form.guardrails.forecastAlertStatus ?? ""}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  guardrails: {
                    ...p.guardrails,
                    forecastAlertStatus: e.target.value === "" ? null : (e.target.value as "OK" | "ALERT"),
                  },
                }))
              }
            >
              <option value="">—</option>
              <option value="OK">OK</option>
              <option value="ALERT">ALERT</option>
            </Select>
          </div>
          <NumberField
            label="New charge threshold"
            value={form.guardrails.newChargeThreshold ?? 0}
            onChange={(v) =>
              setForm((p) => ({ ...p, guardrails: { ...p.guardrails, newChargeThreshold: v } }))
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label>Anomalies</Label>
            <textarea
              className={textareaClass}
              value={form.notes.anomalies}
              onChange={(e) => setForm((p) => ({ ...p, notes: { ...p.notes, anomalies: e.target.value } }))}
            />
          </div>
          <div>
            <Label>Actions taken</Label>
            <textarea
              className={textareaClass}
              value={form.notes.actionsTaken}
              onChange={(e) =>
                setForm((p) => ({ ...p, notes: { ...p.notes, actionsTaken: e.target.value } }))
              }
            />
          </div>
          <div>
            <Label>Actions needed</Label>
            <textarea
              className={textareaClass}
              value={form.notes.actionsNeeded}
              onChange={(e) =>
                setForm((p) => ({ ...p, notes: { ...p.notes, actionsNeeded: e.target.value } }))
              }
            />
          </div>
          <div>
            <Label>New charge categories</Label>
            <textarea
              className={textareaClass}
              value={form.notes.newChargeCategories}
              onChange={(e) =>
                setForm((p) => ({ ...p, notes: { ...p.notes, newChargeCategories: e.target.value } }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Signoff</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          <TextField
            label="Sent to"
            value={form.signoff.sentTo}
            onChange={(v) => setForm((p) => ({ ...p, signoff: { ...p.signoff, sentTo: v } }))}
          />
          <TextField
            label="CC"
            value={form.signoff.cc}
            onChange={(v) => setForm((p) => ({ ...p, signoff: { ...p.signoff, cc: v } }))}
          />
          <TextField
            label="Console timestamp"
            type="datetime-local"
            value={toDateTimeInputValue(form.signoff.consoleTimestamp)}
            onChange={(v) =>
              setForm((p) => ({ ...p, signoff: { ...p.signoff, consoleTimestamp: v || null } }))
            }
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save report"}
        </Button>
      </div>
    </form>
  );
}

const RISK_BADGE: Record<DerivedMetrics["riskStatus"], { variant: "success" | "warning" | "destructive"; icon: string }> = {
  GREEN: { variant: "success", icon: "🟢" },
  YELLOW: { variant: "warning", icon: "🟡" },
  RED: { variant: "destructive", icon: "🔴" },
};

function RiskPreview({ derived }: { derived: DerivedMetrics }) {
  const risk = RISK_BADGE[derived.riskStatus];
  return (
    // Only sticky from md up — on a phone it is tall enough that pinning it would
    // eat most of the viewport while you fill in the form below. top-18 clears the
    // header, which is itself sticky below lg.
    <Card className="md:sticky md:top-18 md:z-10 lg:top-4">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Live preview</CardTitle>
        <Badge variant={risk.variant}>
          {risk.icon} {derived.riskStatus}
        </Badge>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 font-mono text-sm md:grid-cols-4">
        <PreviewStat label="Net billable MTD" value={derived.netBillableMtd} />
        <PreviewStat label="Net billable today" value={derived.netBillableToday} />
        <PreviewStat label="Avg daily gross burn" value={derived.avgDailyGrossBurn} />
        <PreviewStat
          label="Allowed daily burn (projected, run-rate)"
          value={derived.allowedDailyBurn}
        />
        <PreviewStat label="Runway days (projected, run-rate)" value={derived.runwayDays} decimals={0} money={false} />
        <PreviewStat
          label="Exhaustion date (projected, run-rate)"
          text={derived.projectedExhaustionDate ?? "—"}
        />
        <PreviewStat
          label="Month-end gross (projected, run-rate)"
          value={derived.projectedMonthEndGross}
        />
        <PreviewStat label="Month-end net (projected, run-rate)" value={derived.projectedMonthEndNet} />
      </CardContent>
    </Card>
  );
}

function PreviewStat({
  label,
  value,
  text,
  decimals = 2,
  money = true,
}: {
  label: string;
  value?: number | null;
  text?: string;
  decimals?: number;
  money?: boolean;
}) {
  const display =
    text ?? (value == null ? "—" : money ? `$${value.toFixed(decimals)}` : value.toFixed(decimals));
  return (
    <div>
      <Label>{label}</Label>
      <p>{display}</p>
    </div>
  );
}
