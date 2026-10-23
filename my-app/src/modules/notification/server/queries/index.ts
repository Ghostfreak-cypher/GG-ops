import { cache } from "react";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Notification } from "@/models/Notification";
import { Task } from "@/models/Task";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";

export type NotificationDTO = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  isRead: boolean;
  createdAt: string;
  entityType: string | null;
  entityId: string | null;
  /** Resolved from the linked task at read time; null when the task is gone. */
  taskTitle: string | null;
  projectId: string | null;
};

export const listNotifications = cache(async (userId: string): Promise<NotificationDTO[]> => {
  await connectDB();
  const notes = await Notification.find({ userId: parseObjectIdOrThrow(userId) })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  // Batch-resolve linked tasks (title + projectId) for the whole page in one
  // workspace-scoped query.
  const taskNotes = notes.filter((n) => n.entityType === "TASK" && n.entityId);
  const taskById = new Map<string, { title: string; projectId: string }>();
  if (taskNotes.length > 0) {
    const tasks = await Task.find({
      _id: { $in: taskNotes.map((n) => n.entityId as Types.ObjectId) },
      workspaceId: { $in: [...new Set(taskNotes.map((n) => String(n.workspaceId)))] },
    })
      .select("title projectId")
      .lean();
    for (const t of tasks) {
      taskById.set(String(t._id), { title: t.title, projectId: String(t.projectId) });
    }
  }

  return notes.map((n) => {
    const task = n.entityId ? taskById.get(String(n.entityId)) : undefined;
    return {
      id: String(n._id),
      type: n.type,
      title: n.title,
      body: n.body ?? null,
      isRead: n.isRead,
      createdAt: n.createdAt ? new Date(n.createdAt).toISOString() : "",
      entityType: n.entityType ?? null,
      entityId: n.entityId ? String(n.entityId) : null,
      taskTitle: task?.title ?? null,
      projectId: task?.projectId ?? null,
    };
  });
});

export const getUnreadCount = cache(async (userId: string): Promise<number> => {
  await connectDB();
  return Notification.countDocuments({
    userId: parseObjectIdOrThrow(userId),
    isRead: false,
  });
});
