import { notFound } from "next/navigation";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { requireUser } from "@/modules/auth/server/session";
import { getWorkspaceForUser } from "@/modules/workspace/server/queries";
import { searchMembers } from "@/modules/people/server/queries";
import { canInviteMembers } from "@/modules/workspace/server/permissions";
import { MemberGrid } from "./member-grid";

export default async function PeoplePage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const user = await requireUser();
  const ws = await getWorkspaceForUser(workspaceSlug, user.id);
  if (!ws) notFound();

  const members = await searchMembers(ws.id);
  const canInvite = canInviteMembers(ws.role);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">People</h1>
          <p className="text-sm text-muted-foreground">
            {members.length} member{members.length !== 1 ? "s" : ""} in {ws.name}
          </p>
        </div>
        {canInvite && (
          <Link
            href={`/w/${workspaceSlug}/members`}
            className="flex items-center gap-2 border border-foreground px-4 py-2 font-sans text-xs font-semibold uppercase tracking-widest transition-colors hover:bg-foreground hover:text-background"
          >
            <UserPlus className="size-4" />
            Invite
          </Link>
        )}
      </div>

      <MemberGrid members={members} slug={workspaceSlug} currentUserId={user.id} />
    </div>
  );
}
