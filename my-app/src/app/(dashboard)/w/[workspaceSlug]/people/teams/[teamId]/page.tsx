import { notFound } from "next/navigation";
import Link from "next/link";
import { Lock } from "lucide-react";
import { requireUser } from "@/modules/auth/server/session";
import { getWorkspaceForUser } from "@/modules/workspace/server/queries";
import { getTeam, searchMembers } from "@/modules/people/server/queries";
import { canManageMembers } from "@/modules/workspace/server/permissions";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RemoveMemberButton, LeadBadge } from "./team-member-actions";
import { AddMemberPicker } from "./add-member-picker";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; teamId: string }>;
}) {
  const { workspaceSlug, teamId } = await params;
  const user = await requireUser();
  const ws = await getWorkspaceForUser(workspaceSlug, user.id);
  if (!ws) notFound();

  // canManage depends only on ws.role, known before getTeam resolves — so whether
  // searchMembers is needed at all is already decided, and the two reads are independent
  // (the team-membership filter below only needs `team`, applied after both land).
  const canManage = canManageMembers(ws.role);

  const [team, memberCandidates] = await Promise.all([
    getTeam(teamId, ws.id),
    canManage ? searchMembers(ws.id) : Promise.resolve([]),
  ]);
  if (!team) notFound();

  const candidates = canManage
    ? memberCandidates
        .filter((m) => !team.memberIds.includes(m.userId))
        .map((m) => ({
          userId: m.userId,
          name: m.name,
          image: m.image,
          jobTitle: m.jobTitle,
        }))
    : [];

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link
        href={`/w/${workspaceSlug}/people/teams`}
        className="text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground"
      >
        ← Teams
      </Link>

      {/* Hero */}
      <div className="flex flex-wrap items-center gap-4 border border-border p-6">
        <span
          className="size-5 shrink-0"
          style={{ backgroundColor: team.color }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{team.name}</h1>
            {team.isPrivate && (
              <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                <Lock className="size-3.5" />
                Private
              </span>
            )}
          </div>
          {team.description && (
            <p className="mt-1 text-sm text-muted-foreground">{team.description}</p>
          )}
        </div>
        <div className="shrink-0 font-mono text-sm text-muted-foreground">
          {team.memberCount} member{team.memberCount !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border p-0">
          {team.members.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No members yet.</p>
          ) : (
            team.members.map((m) => (
              <div key={m.userId} className="flex items-center justify-between gap-4 px-6 py-3">
                <Link
                  href={`/w/${workspaceSlug}/people/${m.userId}`}
                  className="flex min-w-0 items-center gap-3 hover:opacity-70"
                >
                  <Avatar name={m.name} image={m.image} size="md" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{m.name}</p>
                    {m.jobTitle && (
                      <p className="truncate text-xs text-muted-foreground">{m.jobTitle}</p>
                    )}
                  </div>
                </Link>
                <div className="flex shrink-0 items-center gap-3">
                  {m.isLead && <LeadBadge />}
                  {canManage && (
                    <RemoveMemberButton slug={workspaceSlug} teamId={teamId} userId={m.userId} />
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {canManage && (
        <div className="flex items-center gap-3">
          <AddMemberPicker slug={workspaceSlug} teamId={teamId} candidates={candidates} />
        </div>
      )}
    </div>
  );
}
