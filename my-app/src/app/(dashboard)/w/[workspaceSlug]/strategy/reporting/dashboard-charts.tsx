"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  ResponsiveContainer,
  Legend,
  Label,
} from "recharts";
import type { ReportingData } from "@/modules/dashboard/server/queries/reporting";

const STATUS_COLORS: Record<string, string> = {
  TODO: "#94a3b8",
  IN_PROGRESS: "#3b82f6",
  IN_REVIEW: "#a855f7",
  DONE: "#22c55e",
};

const STATUS_LABELS: Record<string, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  DONE: "Done",
};

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#84cc16",
  LOW: "#1e3a2f",
};

const PRIORITY_LABELS: Record<string, string> = {
  URGENT: "Urgent",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

interface Props {
  data: ReportingData;
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="mb-4 text-sm font-medium">{title}</p>
      {children}
    </div>
  );
}

export function DashboardCharts({ data }: Props) {
  const priorityPieData = data.byPriority.map((d) => ({
    name: PRIORITY_LABELS[d.priority] ?? d.priority,
    value: d.count,
    color: PRIORITY_COLORS[d.priority] ?? "#6b7280",
  }));

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {/* Tasks by status — bar chart */}
      <ChartCard title="Tasks by stage">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data.byStatus} margin={{ left: -20 }}>
            <XAxis
              dataKey="status"
              tickFormatter={(v: string) => STATUS_LABELS[v] ?? v}
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
              labelFormatter={(label) => STATUS_LABELS[String(label)] ?? String(label)}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data.byStatus.map((entry) => (
                <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#6b7280"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Tasks by priority — donut */}
      <ChartCard title="Tasks by priority">
        {data.byPriority.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">No open tasks</div>
        ) : (
          <div className="flex items-center justify-center" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                {/* Percentage radii let the donut shrink beside the legend on a phone.
                    The total sits in a Pie <Label>, which centres on the donut — the old
                    absolutely-positioned div centred on the whole box, legend included. */}
                <Pie
                  data={priorityPieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="55%"
                  outerRadius="78%"
                  paddingAngle={2}
                  startAngle={90}
                  endAngle={-270}
                >
                  {priorityPieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                  <Label
                    value={data.totalOpen}
                    position="center"
                    className="fill-foreground text-2xl font-bold tabular-nums"
                  />
                </Pie>
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  iconType="circle"
                  iconSize={8}
                  formatter={(value: string) => <span style={{ fontSize: 11 }}>{value}</span>}
                />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      {/* Open tasks per member */}
      <ChartCard title="Open tasks per team member">
        {data.byMember.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">No assignments</div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(160, data.byMember.length * 30)}>
            <BarChart data={data.byMember} layout="vertical" margin={{ left: 10, right: 20 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width="auto" />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Tasks" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Open tasks by project */}
      <ChartCard title="Open tasks by project">
        {data.byProject.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">No open tasks</div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(160, data.byProject.length * 30)}>
            <BarChart data={data.byProject} layout="vertical" margin={{ left: 10, right: 20 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width="auto" />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Tasks" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
