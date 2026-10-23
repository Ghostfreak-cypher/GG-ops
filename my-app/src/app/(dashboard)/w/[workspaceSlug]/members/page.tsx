import { notFound } from "next/navigation";
import { requireUser } from "@/modules/auth/server/session";
import { getWorkspaceForUser, listMembers, listPendingInvites } from "@/modules/workspace/server/queries";
import {
  canInviteMembers,
  canManageMembers,
} from "@/modules/workspace/server/permissions";
import { InviteForm } from "./invite-form";
import { MembersTable } from "./members-table";
import { PendingInvites } from "./pending-invites";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const user = await requireUser();
  const ws = await getWorkspaceForUser(workspaceSlug, user.id);
  if (!ws) notFound();

  const [members, pendingInvites] = await Promise.all([
    listMembers(ws.id),
    listPendingInvites(ws.id),
  ]);

  const canInvite = canInviteMembers(ws.role);
  const canManage = canManageMembers(ws.role);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
        <p className="text-sm text-muted-foreground">
          {members.length} active member{members.length !== 1 ? "s" : ""}
          {pendingInvites.length > 0 &&
            ` · ${pendingInvites.length} pending invite${pendingInvites.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      {canInvite && <InviteForm slug={ws.slug} />}

      <MembersTable
        members={members}
        slug={ws.slug}
        currentUserId={user.id}
        canManage={canManage}
      />

      <PendingInvites
        invites={pendingInvites}
        slug={ws.slug}
        canManage={canInvite}
      />
    </div>
  );
}
