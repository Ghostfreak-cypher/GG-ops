import { notFound } from "next/navigation";
import Link from "next/link";
import { Plus, Lock } from "lucide-react";
import { requireUser } from "@/modules/auth/server/session";
import { getWorkspaceForUser } from "@/modules/workspace/server/queries";
import { listTeams } from "@/modules/people/server/queries";
import { canManageMembers } from "@/modules/workspace/server/permissions";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateTeamForm } from "./create-team-form";

export default async function TeamsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const user = await requireUser();
  const ws = await getWorkspaceForUser(workspaceSlug, user.id);
  if (!ws) notFound();

  const teams = await listTeams(ws.id, user.id);
  const canManage = canManageMembers(ws.role);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Teams</h1>
          <p className="text-sm text-muted-foreground">
            {teams.length} team{teams.length !== 1 ? "s" : ""} in {ws.name}
          </p>
        </div>
      </div>

      {/* Teams grid */}
      {teams.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <Link
              key={team.id}
              href={`/w/${workspaceSlug}/people/teams/${team.id}`}
              className="group border border-border p-5 transition-colors hover:border-foreground"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className="size-3 shrink-0"
                    style={{ backgroundColor: team.color }}
                  />
                  <span className="font-semibold">{team.name}</span>
                  {team.isPrivate && (
                    <Lock className="size-3.5 text-muted-foreground" />
                  )}
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  {team.memberCount} member{team.memberCount !== 1 ? "s" : ""}
                </span>
              </div>
              {team.description && (
                <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
                  {team.description}
                </p>
              )}
              {/* Member avatars preview */}
              <div className="flex -space-x-1.5">
                {team.members.slice(0, 5).map((m) => (
                  <Avatar key={m.userId} name={m.name} image={m.image} size="sm" />
                ))}
                {team.memberCount > 5 && (
                  <span className="flex size-6 items-center justify-center border border-border bg-muted font-mono text-[10px] text-muted-foreground">
                    +{team.memberCount - 5}
                  </span>
                )}
              </div>
            </Link>
          ))}

          {canManage && (
            <Link
              href={`/w/${workspaceSlug}/people/teams/new`}
              className="flex flex-col items-center justify-center gap-2 border border-dashed border-border p-5 text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
            >
              <Plus className="size-5" />
              <span className="font-sans text-xs font-semibold uppercase tracking-widest">
                New team
              </span>
            </Link>
          )}
        </div>
      ) : canManage ? (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            No teams yet. Create one to group your workspace members.
          </p>
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Create your first team</CardTitle>
            </CardHeader>
            <CardContent>
              <CreateTeamForm slug={workspaceSlug} />
            </CardContent>
          </Card>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No teams in this workspace yet.</p>
      )}
    </div>
  );
}
