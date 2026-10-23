"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { useTheme } from "next-themes";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import type { SpendReportDTO } from "@/modules/spend-report/server/dto";

// Validated categorical slots (blue/aqua/violet) from the palette — see
// scripts/validate_palette.js. Light/dark steps of the same hues, chosen so each
// clears contrast against this app's pure white/black card surfaces.
const COLORS = {
  light: { gross: "#2a78d6", net: "#1baf7a", runway: "#4a3aa7" },
  dark: { gross: "#3987e5", net: "#199e70", runway: "#9085e9" },
};

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function tickFormatter(value: string): string {
  try {
    return format(parseISO(value), "MMM d");
  } catch {
    return value;
  }
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mb-4 text-xs text-muted-foreground">{subtitle}</p>
      {children}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function TrendCharts({ reports }: { reports: SpendReportDTO[] }) {
  // `resolvedTheme` is undefined on the server and on the first client render alike (next-themes
  // resolves it post-hydration), so both initial passes agree on COLORS.light — no SSR mismatch —
  // then next-themes' own state update repaints with the resolved theme's colors.
  const { resolvedTheme } = useTheme();
  const colors = resolvedTheme === "dark" ? COLORS.dark : COLORS.light;

  if (reports.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center sm:p-10">
        <p className="text-sm text-muted-foreground">No reports in this range yet.</p>
      </div>
    );
  }

  const burnData = reports.map((r) => ({
    date: r.date,
    gross: r.spend.grossToday,
    net: r.derived.netBillableToday,
  }));

  const runwayData = reports
    .filter((r) => r.derived.runwayDays !== null)
    .map((r) => ({ date: r.date, runwayDays: Math.round((r.derived.runwayDays as number) * 10) / 10 }));

  const projectedData = reports.map((r) => ({
    date: r.date,
    projectedGross: Math.round(r.derived.projectedMonthEndGross),
    projectedNet: Math.round(r.derived.projectedMonthEndNet),
  }));

  const tickStyle = { fontSize: 11, fill: "var(--muted-foreground)" };
  const gridStroke = "var(--border)";
  const tooltipStyle = {
    fontSize: 12,
    borderRadius: 8,
    background: "var(--popover)",
    color: "var(--popover-foreground)",
    border: "1px solid var(--border)",
  };
  const legendFormatter = (value: string) => (
    <span style={{ color: "var(--muted-foreground)", fontSize: 11 }}>{value}</span>
  );

  return (
    <div className="space-y-5">
      <ChartCard title="Gross vs. net burn" subtitle="Daily spend — gross vs. after credits applied">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={burnData} margin={{ left: -10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={tickFormatter}
              tick={tickStyle}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              tick={tickStyle}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => formatMoney(v)}
              width={72}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={(l) => tickFormatter(String(l))}
              formatter={(v) => formatMoney(Number(v))}
            />
            <Legend formatter={legendFormatter} iconType="line" iconSize={14} />
            <Line type="monotone" dataKey="gross" name="Gross" stroke={colors.gross} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="net" name="Net" stroke={colors.net} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Runway trend" subtitle="Projected (run-rate) days of credit remaining">
          {runwayData.length === 0 ? (
            <EmptyState message="No runway data yet — needs a credits program with remaining balance." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={runwayData} margin={{ left: -10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={tickFormatter}
                  tick={tickStyle}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis tick={tickStyle} axisLine={false} tickLine={false} width={36} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(l) => tickFormatter(String(l))}
                  formatter={(v) => [`${Number(v)} days`, "Runway"]}
                />
                <Line
                  type="monotone"
                  dataKey="runwayDays"
                  name="Runway (days)"
                  stroke={colors.runway}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Projected month-end" subtitle="Run-rate forecast — gross vs. net">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={projectedData} margin={{ left: -10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={tickFormatter}
                tick={tickStyle}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                tick={tickStyle}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => formatMoney(v)}
                width={72}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(l) => tickFormatter(String(l))}
                formatter={(v) => formatMoney(Number(v))}
              />
              <Legend formatter={legendFormatter} iconType="line" iconSize={14} />
              <Line
                type="monotone"
                dataKey="projectedGross"
                name="Projected gross"
                stroke={colors.gross}
                strokeWidth={2}
                strokeDasharray="4 3"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="projectedNet"
                name="Projected net"
                stroke={colors.net}
                strokeWidth={2}
                strokeDasharray="4 3"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
