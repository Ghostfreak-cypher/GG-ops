"use server";

import { connectDB } from "@/lib/db";
import { Notification } from "@/models/Notification";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { requireUser } from "@/modules/auth/server/session";
import type { ActionResult } from "@/lib/action-result";

export async function markNotificationReadAction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  await connectDB();
  await Notification.updateOne(
    { _id: parseObjectIdOrThrow(id), userId: parseObjectIdOrThrow(user.id) },
    { $set: { isRead: true, readAt: new Date() } },
  );
  return { ok: true };
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  const user = await requireUser();
  await connectDB();
  await Notification.updateMany(
    { userId: parseObjectIdOrThrow(user.id), isRead: false },
    { $set: { isRead: true, readAt: new Date() } },
  );
  return { ok: true };
}
