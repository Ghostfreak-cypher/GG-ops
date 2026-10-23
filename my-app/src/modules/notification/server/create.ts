import { connectDB } from "@/lib/db";
import { Notification } from "@/models/Notification";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { publish } from "@/lib/pusher";

export type NotificationInput = {
  userId: string;
  workspaceId: string;
  type: string;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
};

/** Bulk-create in-app notifications and fire the realtime publish seam per recipient. */
export async function notify(entries: NotificationInput[]): Promise<void> {
  if (entries.length === 0) return;
  await connectDB();

  await Notification.insertMany(
    entries.map((e) => ({
      userId: parseObjectIdOrThrow(e.userId),
      workspaceId: parseObjectIdOrThrow(e.workspaceId),
      type: e.type,
      title: e.title,
      body: e.body ?? null,
      entityType: e.entityType ?? null,
      entityId: e.entityId ? parseObjectIdOrThrow(e.entityId) : null,
    })),
  );

  await Promise.all(
    entries.map((e) =>
      publish(`user-${e.userId}`, "notification.created", { type: e.type, title: e.title }),
    ),
  );
}
