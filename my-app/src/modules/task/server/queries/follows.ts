import { connectDB } from "@/lib/db";
import { TaskFollow } from "@/models/TaskFollow";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";

export async function getTaskFollowers(workspaceId: string, taskId: string): Promise<string[]> {
  await connectDB();
  const follows = await TaskFollow.find({
    workspaceId: parseObjectIdOrThrow(workspaceId),
    taskId: parseObjectIdOrThrow(taskId),
  })
    .select("userId")
    .lean();
  return follows.map((f) => String(f.userId));
}

export async function isFollowingTask(
  workspaceId: string,
  taskId: string,
  userId: string,
): Promise<boolean> {
  await connectDB();
  const hit = await TaskFollow.exists({
    workspaceId: parseObjectIdOrThrow(workspaceId),
    taskId: parseObjectIdOrThrow(taskId),
    userId: parseObjectIdOrThrow(userId),
  });
  return !!hit;
}
