import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listWorkspaceEmailPreferences } from "@/lib/notification-preferences";
import { requireUser } from "@/modules/auth/server/session";
import { getWorkspaceForUser } from "@/modules/workspace/server/queries";
import { WorkspaceEmailPreferencesForm } from "./workspace-email-preferences-form";

export default async function NotificationSettingsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const user = await requireUser();
  const ws = await getWorkspaceForUser(workspaceSlug, user.id);
  if (!ws) notFound();

  const prefs = await listWorkspaceEmailPreferences(user.id, ws.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notification settings</h1>
        <p className="text-sm text-muted-foreground">Choose which workspace emails you receive.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{ws.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <WorkspaceEmailPreferencesForm slug={ws.slug} initial={prefs} />
        </CardContent>
      </Card>
    </div>
  );
}
