import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/modules/auth/server/session";
import { getWorkspaceForUser } from "@/modules/workspace/server/queries";
import { canManageMembers } from "@/modules/workspace/server/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateTeamForm } from "../create-team-form";

export default async function NewTeamPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const user = await requireUser();
  const ws = await getWorkspaceForUser(workspaceSlug, user.id);
  if (!ws) notFound();
  if (!canManageMembers(ws.role)) notFound();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Link
          href={`/w/${workspaceSlug}/people/teams`}
          className="text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          ← Teams
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New team</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team details</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateTeamForm slug={workspaceSlug} />
        </CardContent>
      </Card>
    </div>
  );
}
