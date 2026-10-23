import { listMembers } from "@/modules/workspace/server/queries";
import { notify } from "@/modules/notification/server/create";
import { resolveMentionRecipients } from "@/lib/mentions";
import { getPlainText } from "@/lib/get-plain-text";

/**
 * Notify members newly @mentioned in a task description (in-app only, no
 * emails). Pass `previousDescription` on edits so members mentioned in the
 * old text aren't re-notified by unrelated changes.
 */
export async function notifyDescriptionMentions(params: {
  workspaceId: string;
  taskId: string;
  taskTitle: string;
  actorId: string;
  actorName: string;
  description: string;
  previousDescription?: string;
}): Promise<void> {
  const members = await listMembers(params.workspaceId);
  const mentionMembers = members.map((m) => ({
    userId: m.userId,
    name: m.name,
    email: m.email,
  }));

  const next = resolveMentionRecipients(params.description, mentionMembers, params.actorId);
  const prev = params.previousDescription
    ? resolveMentionRecipients(params.previousDescription, mentionMembers, params.actorId)
    : { explicitIds: [], allIds: [] };

  const alreadyMentioned = new Set([...prev.explicitIds, ...prev.allIds]);
  const explicit = new Set(next.explicitIds);
  const recipients = [...next.explicitIds, ...next.allIds].filter(
    (id) => !alreadyMentioned.has(id),
  );
  if (recipients.length === 0) return;

  await notify(
    recipients.map((userId) => ({
      userId,
      workspaceId: params.workspaceId,
      type: "COMMENT_MENTION",
      title: `${params.actorName} mentioned ${explicit.has(userId) ? "you" : "everyone"} in "${params.taskTitle}"`,
      body: getPlainText(params.description),
      entityType: "TASK",
      entityId: params.taskId,
    })),
  );
}
