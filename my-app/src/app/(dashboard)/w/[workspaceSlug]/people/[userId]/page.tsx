import { notFound } from "next/navigation";
import Link from "next/link";
import { Pencil, ExternalLink } from "lucide-react";
import { requireUser } from "@/modules/auth/server/session";
import { getWorkspaceForUser } from "@/modules/workspace/server/queries";
import {
  getMemberProfile,
  getFrequentCollaborators,
  getMemberOpenTasks,
  getMemberRecentProjects,
  listTeams,
} from "@/modules/people/server/queries";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; userId: string }>;
}) {
  const { workspaceSlug, userId } = await params;
  const user = await requireUser();
  const ws = await getWorkspaceForUser(workspaceSlug, user.id);
  if (!ws) notFound();

  const [profile, collaborators, tasks, projects, allTeams] = await Promise.all([
    getMemberProfile(ws.id, userId),
    getFrequentCollaborators(ws.id, userId),
    getMemberOpenTasks(ws.id, userId),
    getMemberRecentProjects(ws.id, userId),
    listTeams(ws.id),
  ]);
  if (!profile) notFound();

  // Teams this person belongs to (listTeams returns all workspace teams).
  const memberTeams = allTeams.filter((t) => t.memberIds.includes(userId));

  const isSelf = userId === user.id;
  const isOoo =
    profile.outOfOfficeEnabled &&
    profile.outOfOfficeUntil &&
    new Date(profile.outOfOfficeUntil) >= new Date();

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href={`/w/${workspaceSlug}/people`}
        className="text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground"
      >
        ← People
      </Link>

      {/* Hero */}
      <div className="flex flex-wrap items-start gap-6 border border-border p-6">
        <Avatar name={profile.name} image={profile.image} size="lg" className="!size-16 text-lg" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{profile.name}</h1>
            <Badge variant={profile.role === "MAINTAINER" ? "default" : "secondary"}>
              {profile.role}
            </Badge>
            {isOoo && (
              <span className="border border-amber-600 px-2 py-0.5 font-mono text-[10px] uppercase text-amber-600">
                Out of office
                {profile.outOfOfficeUntil &&
                  ` until ${new Date(profile.outOfOfficeUntil).toLocaleDateString()}`}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {profile.jobTitle && <span>{profile.jobTitle}</span>}
            {profile.department && <span>{profile.department}</span>}
          </div>
          {profile.bio && <p className="text-sm text-foreground">{profile.bio}</p>}
          {isOoo && profile.outOfOfficeMessage && (
            <p className="border-l-2 border-amber-600 pl-3 text-sm text-muted-foreground italic">
              {profile.outOfOfficeMessage}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          {profile.pronounceUrl && (
            <a
              href={profile.pronounceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 border border-border px-3 py-1.5 font-sans text-xs font-semibold uppercase tracking-widest transition-colors hover:border-foreground"
            >
              <ExternalLink className="size-3" />
              Pronounce
            </a>
          )}
          {isSelf && (
            <Link
              href="/account/profile"
              className="flex items-center gap-1.5 border border-foreground bg-foreground px-3 py-1.5 font-sans text-xs font-semibold uppercase tracking-widest text-background transition-colors hover:bg-transparent hover:text-foreground"
            >
              <Pencil className="size-3" />
              Edit profile
            </Link>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: tasks + projects */}
        <div className="space-y-6 lg:col-span-2">
          {/* My Tasks widget */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-widest">
                {isSelf ? "My tasks" : `${profile.name.split(" ")[0]}'s tasks`}
              </CardTitle>
              <Link
                href={`/w/${workspaceSlug}/my-tasks`}
                className="border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
              >
                View all tasks
              </Link>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No open tasks.</p>
              ) : (
                <div className="space-y-2">
                  {tasks.map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-border last:border-b-0">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{t.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          <span
                            className="mr-1 inline-block size-2 rounded-full"
                            style={{ backgroundColor: t.projectColor ?? "#666" }}
                          />
                          {t.projectName}
                        </p>
                      </div>
                      {t.dueDate && (
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                          {new Date(t.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent projects widget */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-widest">
                Recent projects
              </CardTitle>
            </CardHeader>
            <CardContent>
              {projects.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent projects.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {projects.map((p) => (
                    <Link
                      key={p.id}
                      href={`/w/${workspaceSlug}/projects/${p.id}`}
                      className="flex items-center gap-2.5 border border-border p-3 transition-colors hover:border-foreground"
                    >
                      <span
                        className="size-3 shrink-0"
                        style={{ backgroundColor: p.color ?? "#000" }}
                      />
                      <span className="truncate text-sm font-medium">{p.name}</span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: teams + collaborators */}
        <div className="space-y-6">
          {/* Teams widget */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-widest">
                Teams
              </CardTitle>
            </CardHeader>
            <CardContent>
              {memberTeams.length === 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Not in any teams yet.</p>
                  <Link
                    href={`/w/${workspaceSlug}/people/teams`}
                    className="inline-block text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Browse teams →
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {memberTeams.map((team) => (
                    <Link
                      key={team.id}
                      href={`/w/${workspaceSlug}/people/teams/${team.id}`}
                      className="flex items-center gap-2.5 border border-border p-3 transition-colors hover:border-foreground"
                    >
                      <span
                        className="size-3 shrink-0 rounded-full"
                        style={{ backgroundColor: team.color }}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {team.name}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                        {team.memberCount} member{team.memberCount !== 1 ? "s" : ""}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Frequent collaborators */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-widest">
                Frequent collaborators
              </CardTitle>
            </CardHeader>
            <CardContent>
              {collaborators.length === 0 ? (
                <p className="text-sm text-muted-foreground">No collaborators yet.</p>
              ) : (
                <div className="space-y-3">
                  {collaborators.map((c) => (
                    <Link
                      key={c.userId}
                      href={`/w/${workspaceSlug}/people/${c.userId}`}
                      className="flex items-center gap-3 transition-opacity hover:opacity-70"
                    >
                      <Avatar name={c.name} image={c.image} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{c.name}</p>
                        {(c.jobTitle || c.department) && (
                          <p className="truncate text-xs text-muted-foreground">
                            {c.jobTitle ?? c.department}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                        {c.sharedTaskCount} task{c.sharedTaskCount !== 1 ? "s" : ""}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Join info */}
          {profile.joinedAt && (
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">
                  Joined{" "}
                  <span className="font-semibold text-foreground">
                    {new Date(profile.joinedAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
