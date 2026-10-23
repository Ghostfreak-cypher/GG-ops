import { cache } from "react";
import { connectDB } from "@/lib/db";
import { ActivityLog } from "@/models/ActivityLog";
import { User } from "@/models/User";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";

export type ActivityDTO = {
  id: string;
  action: string;
  actor: string;
  createdAt: string;
};

/** Recent activity for a task. Call from access-verified contexts (e.g. the task page). */
export const getTaskActivity = cache(async (taskId: string): Promise<ActivityDTO[]> => {
  await connectDB();
  const logs = await ActivityLog.find({ taskId: parseObjectIdOrThrow(taskId) })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const actorIds = [...new Set(logs.map((l) => l.actorId).filter(Boolean).map(String))];
  const users = actorIds.length
    ? await User.find({ _id: { $in: actorIds } }).select("name").lean()
    : [];
  const nameById = new Map(users.map((u) => [String(u._id), u.name]));

  return logs.map((l) => ({
    id: String(l._id),
    action: l.action,
    actor: l.actorId ? (nameById.get(String(l.actorId)) ?? "Someone") : "System",
    createdAt: l.createdAt ? new Date(l.createdAt).toISOString() : "",
  }));
});
