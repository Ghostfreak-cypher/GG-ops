import { handle } from "@/lib/api/handler";
import { err } from "@/lib/api/response";
import { getCurrentUser } from "@/modules/auth/server/session";
import { getWorkspaceForUser, listMembers } from "@/modules/workspace/server/queries";

type Ctx = { params: Promise<{ slug: string }> };

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const user = await getCurrentUser();
  if (!user) return err("Unauthorized", 401);

  const { slug } = await ctx.params;
  const ws = await getWorkspaceForUser(slug, user.id);
  if (!ws) return err("Not found", 404);

  const members = await listMembers(ws.id);

  const header = "Name,Email,Job Title,Role,Status,Joined\r\n";
  const rows = members
    .map((m) => {
      const joined = m.joinedAt
        ? new Date(m.joinedAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : "";
      return [
        csvCell(m.name),
        csvCell(m.email),
        csvCell(m.jobTitle ?? ""),
        csvCell(m.role),
        csvCell(m.status),
        csvCell(joined),
      ].join(",");
    })
    .join("\r\n");

  const csv = header + rows;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="members-${slug}.csv"`,
    },
  });
});

function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
