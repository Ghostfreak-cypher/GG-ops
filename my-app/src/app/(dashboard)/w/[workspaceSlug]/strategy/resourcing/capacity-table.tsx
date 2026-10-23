import type { CapacityData } from "@/modules/dashboard/server/queries/resourcing";

const PROJECT_COLORS = [
  "#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#84cc16",
];

export function CapacityTable({ data }: { data: CapacityData }) {
  const { months, members, projects, cells } = data;

  function getCount(memberId: string, projectId: string, monthKey: string): number {
    return cells.find(
      (c) => c.memberId === memberId && c.projectId === projectId && c.monthKey === monthKey,
    )?.count ?? 0;
  }

  const projectColorMap = new Map(
    projects.map((p, i) => [p.id, p.color ?? PROJECT_COLORS[i % PROJECT_COLORS.length]]),
  );

  // Max count across all cells for relative bar width
  const maxCount = Math.max(...cells.map((c) => c.count), 1);

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="w-48 px-4 py-3 text-left max-md:sticky max-md:left-0 max-md:z-10 max-md:bg-card text-xs font-medium text-muted-foreground">
              Project / Member
            </th>
            {months.map((m) => (
              <th key={m.key} className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">
                {m.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => {
            const color = projectColorMap.get(project.id) ?? "#6366f1";
            const projectMembers = members.filter((m) =>
              months.some((mo) => getCount(m.id, project.id, mo.key) > 0),
            );
            if (projectMembers.length === 0) return null;

            return (
              <>
                {/* Project header row */}
                <tr key={`proj-${project.id}`} className="border-b border-border/40 bg-muted/10">
                  <td className="px-4 py-2.5 max-md:sticky max-md:left-0 max-md:z-10 max-md:bg-card">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-3 shrink-0 rounded-sm"
                        style={{ backgroundColor: color }}
                      />
                      <span className="font-medium text-foreground">{project.name}</span>
                    </div>
                  </td>
                  {months.map((m) => {
                    const total = projectMembers.reduce(
                      (s, mem) => s + getCount(mem.id, project.id, m.key),
                      0,
                    );
                    return (
                      <td key={m.key} className="px-4 py-2.5 text-center">
                        {total > 0 && (
                          <span className="text-xs font-medium text-muted-foreground">
                            {total} task{total !== 1 ? "s" : ""}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* Member rows */}
                {projectMembers.map((member) => (
                  <tr key={`${project.id}-${member.id}`} className="border-b border-border/30 hover:bg-accent/20 transition-colors">
                    <td className="py-2 pl-10 pr-4 max-md:sticky max-md:left-0 max-md:z-10 max-md:bg-card">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        {member.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={member.image} alt={member.name} className="size-5 rounded-full object-cover" />
                        ) : (
                          <span className="grid size-5 place-items-center rounded-full bg-secondary text-[9px] font-medium uppercase">
                            {member.name.slice(0, 2)}
                          </span>
                        )}
                        <span className="text-xs">{member.name}</span>
                      </div>
                    </td>
                    {months.map((m) => {
                      const count = getCount(member.id, project.id, m.key);
                      return (
                        <td key={m.key} className="px-4 py-2">
                          {count > 0 && (
                            <div className="flex items-center gap-1.5">
                              <div className="h-5 flex-1 overflow-hidden rounded-sm" style={{ backgroundColor: `${color}22` }}>
                                <div
                                  className="h-full rounded-sm transition-all"
                                  style={{
                                    width: `${Math.max(20, (count / maxCount) * 100)}%`,
                                    backgroundColor: color,
                                  }}
                                />
                              </div>
                              <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
                                {count}
                              </span>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
