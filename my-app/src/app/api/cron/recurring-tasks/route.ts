import { Types } from "mongoose";
import { handle } from "@/lib/api/handler";
import { ok, err } from "@/lib/api/response";
import { isCronAuthorized } from "@/lib/cron";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { connectDB } from "@/lib/db";
import { Task } from "@/models/Task";
import { withTransaction } from "@/lib/mongo/transactions";

type RecurrenceRule = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

type RecurringTaskLean = {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  projectId: Types.ObjectId;
  sectionId: Types.ObjectId | null;
  title: string;
  description?: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  type: "TASK" | "BUG" | "FEATURE" | "CHORE" | "MILESTONE";
  assigneeIds: Types.ObjectId[];
  labelIds: Types.ObjectId[];
  dueDate?: Date | null;
  completedAt?: Date | null;
  createdBy: Types.ObjectId;
  position?: number;
  recurrenceRule: RecurrenceRule;
};

function computeNextDueDate(rule: RecurrenceRule, base: Date): Date {
  const d = new Date(base);
  switch (rule) {
    case "DAILY":
      d.setDate(d.getDate() + 1);
      break;
    case "WEEKLY":
      d.setDate(d.getDate() + 7);
      break;
    case "MONTHLY":
      d.setMonth(d.getMonth() + 1);
      break;
    case "YEARLY":
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d;
}

async function spawnRecurringTasks(): Promise<{ spawned: number }> {
  await connectDB();

  const tasks = await Task.find({
    recurrenceRule: { $ne: null },
    status: "DONE",
    isArchived: false,
  })
    .lean()
    .then((docs) => docs as unknown as RecurringTaskLean[]);

  let spawned = 0;

  for (const task of tasks) {
    const childExists = await Task.exists({
      recurrenceParentId: task._id,
    });
    if (childExists) continue;

    const baseDate = task.dueDate ?? task.completedAt ?? new Date();
    const nextDue = computeNextDueDate(task.recurrenceRule, baseDate);

    await withTransaction(async (session) => {
      await Task.create(
        [
          {
            workspaceId: task.workspaceId,
            projectId: task.projectId,
            sectionId: task.sectionId,
            title: task.title,
            description: task.description ?? null,
            status: "TODO" as const,
            priority: task.priority,
            type: task.type,
            assigneeIds: task.assigneeIds,
            labelIds: task.labelIds,
            dueDate: nextDue,
            recurrenceRule: task.recurrenceRule,
            recurrenceParentId: task._id,
            createdBy: task.createdBy,
            position: task.position ?? 0,
          },
        ],
        { session },
      );
    });

    spawned++;
  }

  return { spawned };
}

async function run(req: Request) {
  if (!isCronAuthorized(req)) return err("Unauthorized", 401);
  const limited = await rateLimit(
    `cron:${clientIp(req)}:${new URL(req.url).pathname}`,
    10,
    3600,
  );
  if (!limited.allowed) return err("Too Many Requests", 429);
  return ok(await spawnRecurringTasks());
}

export const GET = handle(run);
export const POST = handle(run);
