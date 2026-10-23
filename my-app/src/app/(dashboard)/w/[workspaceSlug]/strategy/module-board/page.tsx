import { ModuleBoardView } from "@/modules/module-board/ui/module-board-view";
import { canEditModuleBoard, requireModuleBoardWorkspace } from "@/modules/module-board/access";
import { getModuleBoard } from "@/modules/module-board/server/queries";
import { listMembers } from "@/modules/workspace/server/queries";

export default async function ModuleBoardPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const access = await requireModuleBoardWorkspace(workspaceSlug);

  const [board, members] = await Promise.all([
    getModuleBoard(access.workspace.id, access.workspace.slug, access.userId),
    listMembers(access.workspace.id),
  ]);

  return (
    <ModuleBoardView
      board={board}
      members={members.map((member) => ({
        userId: member.userId,
        name: member.name,
        image: member.image,
        role: member.role,
      }))}
      workspaceSlug={access.workspace.slug}
      canEdit={canEditModuleBoard(access.role)}
      viewerRole={access.role}
    />
  );
}
