import { cache } from "react";
import { connectDB } from "@/lib/db";
import { Section } from "@/models/Section";
import { Task, type TaskDoc } from "@/models/Task";
import { Label } from "@/models/Label";
import { User } from "@/models/User";
import { Project } from "@/models/Project";
import { Comment } from "@/models/Comment";
import { Attachment } from "@/models/Attachment";
import { WorkspaceMember } from "@/models/WorkspaceMember";
import { isValidObjectId, parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { getProjectForUser } from "@/modules/project/server/access";
import { buildTaskFilter, type TaskFilters } from "@/modules/task/filters";
import { logger } from "@/lib/logger";
import { TaskDependency } from "@/models/TaskDependency";
import type { BoardData, TaskDTO, TaskDetailDTO } from "@/modules/task/server/dto";
import type { TaskStatus, TaskPriority, TaskType } from "@/modules/task/constants";

type LeanTask = TaskDoc & { _id: unknown };
type LeanUser = { _id: unknown; name?: string; image?: string | null };

/** Per-task comment/attachment counts, keyed by task id string. Defaults to 0. */
type TaskCounts = { comments?: Map<string, number>; attachments?: Map<string, number> };

export type TaskSearchResult = {
  id: string;
  title: string;
  description: string | null;
  projectId: string;
  projectName: string;
};

function mapTask(
  t: LeanTask,
  userById: Map<string, LeanUser>,
  counts: TaskCounts = {},
  blockedByMap: Map<string, number> = new Map(),
): TaskDTO {
  const id = String(t._id);
  const td = t as unknown as {
    startDate?: Date | null;
    recurrenceRule?: string | null;
    recurrenceParentId?: unknown;
  };
  return {
    id,
    title: t.title,
    description: t.description ?? null,
    status: t.status as TaskStatus,
    priority: t.priority as TaskPriority,
    type: t.type as TaskType,
    sectionId: t.sectionId ? String(t.sectionId) : null,
    position: t.position ?? 0,
    dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
    startDate: td.startDate ? new Date(td.startDate).toISOString() : null,
    assignees: (t.assigneeIds ?? []).map((aid) => {
      const u = userById.get(String(aid));
      return { id: String(aid), name: u?.name ?? "Unknown", image: u?.image ?? null };
    }),
    labelIds: (t.labelIds ?? []).map((lid) => String(lid)),
    commentCount: counts.comments?.get(id) ?? 0,
    attachmentCount: counts.attachments?.get(id) ?? 0,
    blockedByCount: blockedByMap.get(id) ?? 0,
    recurrenceRule: td.recurrenceRule ?? null,
    recurrenceParentId: td.recurrenceParentId ? String(td.recurrenceParentId) : null,
  };
}

/** Group-count a collection by taskId for the given task ids (workspace-scoped). */
async function countByTask(
  model: typeof Comment | typeof Attachment,
  wsId: unknown,
  taskIds: unknown[],
  extraMatch: Record<string, unknown> = {},
): Promise<Map<string, number>> {
  if (taskIds.length === 0) return new Map();
  const rows = await model.aggregate<{ _id: unknown; n: number }>([
    { $match: { workspaceId: wsId, taskId: { $in: taskIds }, ...extraMatch } },
    { $group: { _id: "$taskId", n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
}

async function usersFor(tasks: LeanTask[]): Promise<Map<string, LeanUser>> {
  const ids = [...new Set(tasks.flatMap((t) => (t.assigneeIds ?? []).map((id) => String(id))))];
  if (ids.length === 0) return new Map();
  const users = await User.find({ _id: { $in: ids } }).select("name image").lean();
  return new Map(users.map((u) => [String(u._id), u as LeanUser]));
}

// Every field `mapTask` reads except `description` — kept separate so board reads that
// don't render descriptions (the web board/list/timeline UIs) can skip fetching that
// rich-HTML field without duplicating the rest of the list.
const BOARD_TASK_FIELDS =
  "title status priority type sectionId position dueDate startDate assigneeIds labelIds recurrenceRule recurrenceParentId";

/** Board read (spec §9.1): top-level tasks grouped by section, with optional filters. */
export const getProjectBoard = cache(
  async (
    projectId: string,
    userId: string,
    filters: TaskFilters = {},
    /**
     * The REST v1 API and the MCP `get_project_board` tool publish `description` in every
     * TaskDTO, and neither passes this argument — so they keep fetching it. No web board/
     * list/timeline view renders a card's description, so those four call sites pass
     * `false`. Defaults to `true` so a forgotten call site degrades to correct-and-slow,
     * never to a silently changed public API response.
     */
    withDescription: boolean = true,
  ): Promise<BoardData | null> => {
    const t0 = performance.now();
    const access = await getProjectForUser(projectId, userId);
    if (!access) return null;

    await connectDB();
    const pid = parseObjectIdOrThrow(projectId);
    const wsId = parseObjectIdOrThrow(access.project.workspaceId);

    const safeFilters: TaskFilters = {
      status: filters.status,
      priority: filters.priority,
      assigneeId:
        filters.assigneeId && isValidObjectId(filters.assigneeId) ? filters.assigneeId : undefined,
      labelId: filters.labelId && isValidObjectId(filters.labelId) ? filters.labelId : undefined,
    };
    const taskFilter = buildTaskFilter(
      { workspaceId: wsId, projectId: pid, isArchived: false, parentTaskId: null },
      safeFilters,
    );

    const [sections, tasks, projectDoc, memberCount] = await Promise.all([
      Section.find({ projectId: pid }).sort({ position: 1 }).lean(),
      Task.find(taskFilter)
        .select(withDescription ? `${BOARD_TASK_FIELDS} description` : BOARD_TASK_FIELDS)
        .sort({ sectionId: 1, position: 1 })
        .lean(),
      Project.findById(pid).select("description color icon statusColor statusNote statusUpdatedAt").lean(),
      WorkspaceMember.countDocuments({ workspaceId: wsId, status: "ACTIVE" }),
    ]);

    const leanTasks = tasks as unknown as LeanTask[];
    const taskIds = leanTasks.map((t) => t._id);

    // Count unresolved blockers per task (fromTaskId → how many toTaskId deps have non-DONE blockers)
    async function countBlockedBy(tIds: unknown[]): Promise<Map<string, number>> {
      if (tIds.length === 0) return new Map();
      const rows = await TaskDependency.aggregate<{ _id: unknown; n: number }>([
        { $match: { workspaceId: wsId, fromTaskId: { $in: tIds } } },
        {
          $lookup: {
            from: "tasks",
            localField: "toTaskId",
            foreignField: "_id",
            // Only `status` is read below — without this the join pulls each blocker's
            // full document (description included) just to discard it two stages later.
            pipeline: [{ $project: { status: 1 } }],
            as: "blocker",
          },
        },
        { $unwind: "$blocker" },
        { $match: { "blocker.status": { $ne: "DONE" } } },
        { $group: { _id: "$fromTaskId", n: { $sum: 1 } } },
      ]);
      return new Map(rows.map((r) => [String(r._id), r.n]));
    }

    const [userById, commentCounts, attachmentCounts, blockedByMap] = await Promise.all([
      usersFor(leanTasks),
      countByTask(Comment, wsId, taskIds, { deletedAt: null }),
      countByTask(Attachment, wsId, taskIds),
      countBlockedBy(taskIds),
    ]);
    const counts: TaskCounts = { comments: commentCounts, attachments: attachmentCounts };

    const bySection = new Map<string, TaskDTO[]>();
    const unsectioned: TaskDTO[] = [];
    for (const t of leanTasks) {
      const dto = mapTask(t, userById, counts, blockedByMap);
      if (dto.sectionId) {
        const arr = bySection.get(dto.sectionId) ?? [];
        arr.push(dto);
        bySection.set(dto.sectionId, arr);
      } else {
        unsectioned.push(dto);
      }
    }

    type PDoc = { description?: string | null; color?: string | null; icon?: string | null; statusColor?: string | null; statusNote?: string | null; statusUpdatedAt?: Date | null } | null;
    const pd = projectDoc as PDoc;
    const result: BoardData = {
      projectId,
      projectName: access.project.name,
      projectDescription: pd?.description ?? null,
      projectColor: pd?.color ?? null,
      projectIcon: pd?.icon ?? null,
      projectStatusColor: (pd?.statusColor as import("@/modules/task/server/dto").ProjectStatusColor | null) ?? null,
      projectStatusNote: pd?.statusNote ?? null,
      projectStatusUpdatedAt: pd?.statusUpdatedAt ? pd.statusUpdatedAt.toISOString() : null,
      memberCount,
      sections: sections.map((s) => ({
        id: String(s._id),
        name: s.name,
        position: s.position ?? 0,
        tasks: bySection.get(String(s._id)) ?? [],
      })),
      unsectioned,
    };

    logger.perf("board.load", performance.now() - t0, {
      workspaceId: access.project.workspaceId,
      projectId,
      taskCount: leanTasks.length,
      sectionCount: sections.length,
    });

    return result;
  },
);

/** Full detail for one task: fields + resolved labels + direct subtasks. */
export const getTaskDetail = cache(
  async (taskId: string, userId: string): Promise<TaskDetailDTO | null> => {
    await connectDB();
    const tid = parseObjectIdOrThrow(taskId);
    const task = await Task.findOne({ _id: tid, isArchived: false }).lean();
    if (!task) return null;

    const access = await getProjectForUser(String(task.projectId), userId);
    if (!access) return null;

    const leanTask = task as unknown as LeanTask;
    const subtasks = await Task.find({ parentTaskId: tid, isArchived: false })
      .sort({ position: 1 })
      .lean();
    const leanSubs = subtasks as unknown as LeanTask[];

    const userById = await usersFor([leanTask, ...leanSubs]);
    const labelDocs = (leanTask.labelIds ?? []).length
      ? await Label.find({ _id: { $in: leanTask.labelIds } }).select("name color").lean()
      : [];

    return {
      ...mapTask(leanTask, userById),
      parentTaskId: leanTask.parentTaskId ? String(leanTask.parentTaskId) : null,
      labels: labelDocs.map((l) => ({
        id: String(l._id),
        name: l.name,
        color: l.color ?? null,
      })),
      subtasks: leanSubs.map((s) => mapTask(s, userById)),
    };
  },
);

/** Workspace-wide full-text search. Verify access in the caller. */
export const searchTasks = cache(
  async (
    workspaceId: string,
    query: string,
    projectId?: string,
  ): Promise<TaskSearchResult[]> => {
    const q = query.trim();
    if (q.length < 2) return [];
    if (projectId && !isValidObjectId(projectId)) return [];

    await connectDB();
    const workspaceObjectId = parseObjectIdOrThrow(workspaceId);
    const taskMatch: Record<string, unknown> = {
      workspaceId: workspaceObjectId,
      isArchived: false,
      $text: { $search: q },
    };
    if (projectId) {
      taskMatch.projectId = parseObjectIdOrThrow(projectId);
    }

    const tasks = await Task.aggregate<{
      _id: unknown;
      title: string;
      description: string | null;
      projectId: unknown;
    }>([
      { $match: taskMatch },
      { $sort: { score: { $meta: "textScore" } } },
      { $limit: 25 },
      { $project: { title: 1, description: 1, projectId: 1 } },
    ]);

    const projectIds = [...new Set(tasks.map((task) => String(task.projectId)))];
    const projects = projectIds.length
      ? await Project.find({
          _id: { $in: projectIds.map((id) => parseObjectIdOrThrow(id)) },
          workspaceId: workspaceObjectId,
          archivedAt: null,
        })
          .select("name")
          .lean()
      : [];
    const projectNameById = new Map(projects.map((project) => [String(project._id), project.name]));

    return tasks.map((task) => ({
      id: String(task._id),
      title: task.title,
      description: task.description ?? null,
      projectId: String(task.projectId),
      projectName: projectNameById.get(String(task.projectId)) ?? "Unknown project",
    }));
  },
);
