import { notFound } from "next/navigation";
import { requireUser } from "@/modules/auth/server/session";
import { getWorkspaceForUser } from "@/modules/workspace/server/queries";
import { listNotifications } from "@/modules/notification/server/queries";
import { InboxList } from "./inbox-list";

export default async function InboxPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const user = await requireUser();
  const ws = await getWorkspaceForUser(workspaceSlug, user.id);
  if (!ws) notFound();

  const notifications = await listNotifications(user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
      <InboxList notifications={notifications} userId={user.id} workspaceSlug={workspaceSlug} />
    </div>
  );
}
