import { connectDB } from "@/lib/db";
import { enqueue } from "@/lib/queue";
import { absoluteUrl } from "@/lib/urls";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { Workspace } from "@/models/Workspace";
import { WorkspaceMember } from "@/models/WorkspaceMember";
import { Task } from "@/models/Task";
import { Project } from "@/models/Project";
import { User } from "@/models/User";
import { NotificationPreference } from "@/models/NotificationPreference";
import type { TaskDueSummary } from "@/lib/jobs/templates";

type AggRow = { _id: unknown; count: number };

// ---------------------------------------------------------------------------
// Daily digest — per-user: tasks due today + overdue count
// Sent to all active members except those with emailDigest = NONE or WEEKLY
// ---------------------------------------------------------------------------

export async function generateDailyDigests(): Promise<{ sent: number }> {
  await connectDB();
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayEnd = new Date(todayStart.getTime() + 24 * 3600 * 1000);

  const workspaces = await Workspace.find({}).select("_id name slug").lean();
  let sent = 0;

  for (const ws of workspaces) {
    const members = await WorkspaceMember.find({ workspaceId: ws._id, status: "ACTIVE" })
      .select("userId")
      .lean();
    if (members.length === 0) continue;

    const memberUserIds = members.map((m) => m.userId);

    // Skip users who opted out of daily (NONE or WEEKLY-only)
    const optedOut = await NotificationPreference.find({
      workspaceId: ws._id,
      userId: { $in: memberUserIds },
      emailDigest: { $in: ["NONE", "WEEKLY"] },
    })
      .select("userId")
      .lean();
    const optedOutIds = new Set(optedOut.map((p) => String(p.userId)));
    const eligibleIds = memberUserIds.filter((id) => !optedOutIds.has(String(id)));
    if (eligibleIds.length === 0) continue;

    // Tasks due today for eligible members
    const tasksDueToday = await Task.find({
      workspaceId: ws._id,
      assigneeIds: { $in: eligibleIds },
      isArchived: false,
      status: { $ne: "DONE" },
      dueDate: { $gte: todayStart, $lt: todayEnd },
    })
      .select("title projectId assigneeIds")
      .lean();

    // Overdue count per user
    const overdueAgg: AggRow[] = await Task.aggregate([
      {
        $match: {
          workspaceId: ws._id,
          assigneeIds: { $in: eligibleIds },
          isArchived: false,
          status: { $ne: "DONE" },
          dueDate: { $lt: todayStart },
        },
      },
      { $unwind: "$assigneeIds" },
      {
        $match: {
          assigneeIds: { $in: eligibleIds.map((id) => parseObjectIdOrThrow(String(id))) },
        },
      },
      { $group: { _id: "$assigneeIds", count: { $sum: 1 } } },
    ]);

    // Project name map for due-today tasks
    const projectIds = [...new Set(tasksDueToday.map((t) => String(t.projectId)))];
    const projects = await Project.find({ _id: { $in: projectIds } }).select("name").lean();
    const projectMap = new Map(projects.map((p) => [String(p._id), p.name]));

    // Per-user due-today list
    const eligibleIdStrs = new Set(eligibleIds.map(String));
    const dueTodayByUser = new Map<string, TaskDueSummary[]>();
    for (const task of tasksDueToday) {
      for (const uid of task.assigneeIds ?? []) {
        const uidStr = String(uid);
        if (!eligibleIdStrs.has(uidStr)) continue;
        const list = dueTodayByUser.get(uidStr) ?? [];
        list.push({
          title: task.title,
          projectName: projectMap.get(String(task.projectId)) ?? "Unknown project",
          taskUrl: absoluteUrl(
            `/w/${ws.slug}/projects/${String(task.projectId)}/tasks/${String(task._id)}`,
          ),
        });
        dueTodayByUser.set(uidStr, list);
      }
    }

    const overdueByUser = new Map<string, number>(
      overdueAgg.map((r) => [String(r._id), r.count]),
    );

    const users = await User.find({ _id: { $in: eligibleIds }, isActive: true })
      .select("email name")
      .lean();

    for (const u of users) {
      if (!u.email) continue;
      const uidStr = String(u._id);
      const dueToday = dueTodayByUser.get(uidStr) ?? [];
      const overdueCount = overdueByUser.get(uidStr) ?? 0;
      if (dueToday.length === 0 && overdueCount === 0) continue;

      enqueue("daily-digest-email", {
        email: u.email,
        userName: u.name,
        workspaceName: ws.name,
        workspaceUrl: absoluteUrl(`/w/${ws.slug}`),
        tasksDueToday: dueToday,
        overdueCount,
      });
      sent++;
    }
  }

  return { sent };
}

// ---------------------------------------------------------------------------
// Weekly digest — per-user: completed/open/overdue counts + top members
// Sent to all active members except those with emailDigest = NONE
// ---------------------------------------------------------------------------

export async function generateWeeklyDigests(): Promise<{ sent: number }> {
  await connectDB();
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekStart = new Date(todayStart.getTime() - 7 * 24 * 3600 * 1000);

  const workspaces = await Workspace.find({}).select("_id name slug").lean();
  let sent = 0;

  for (const ws of workspaces) {
    const members = await WorkspaceMember.find({ workspaceId: ws._id, status: "ACTIVE" })
      .select("userId")
      .lean();
    if (members.length === 0) continue;

    const memberUserIds = members.map((m) => m.userId);

    // Only skip NONE — both DAILY and WEEKLY users get the weekly digest
    const optedOut = await NotificationPreference.find({
      workspaceId: ws._id,
      userId: { $in: memberUserIds },
      emailDigest: "NONE",
    })
      .select("userId")
      .lean();
    const optedOutIds = new Set(optedOut.map((p) => String(p.userId)));
    const eligibleIds = memberUserIds.filter((id) => !optedOutIds.has(String(id)));
    if (eligibleIds.length === 0) continue;

    const eligibleOids = eligibleIds.map((id) => parseObjectIdOrThrow(String(id)));

    // Parallel aggregations
    const [completedAgg, openAgg, overdueCountAgg, overdueList] = await Promise.all([
      Task.aggregate<AggRow>([
        {
          $match: {
            workspaceId: ws._id,
            assigneeIds: { $in: eligibleIds },
            status: "DONE",
            completedAt: { $gte: weekStart, $lt: todayStart },
          },
        },
        { $unwind: "$assigneeIds" },
        { $match: { assigneeIds: { $in: eligibleOids } } },
        { $group: { _id: "$assigneeIds", count: { $sum: 1 } } },
      ]),
      Task.aggregate<AggRow>([
        {
          $match: {
            workspaceId: ws._id,
            assigneeIds: { $in: eligibleIds },
            isArchived: false,
            status: { $ne: "DONE" },
          },
        },
        { $unwind: "$assigneeIds" },
        { $match: { assigneeIds: { $in: eligibleOids } } },
        { $group: { _id: "$assigneeIds", count: { $sum: 1 } } },
      ]),
      Task.aggregate<AggRow>([
        {
          $match: {
            workspaceId: ws._id,
            assigneeIds: { $in: eligibleIds },
            isArchived: false,
            status: { $ne: "DONE" },
            dueDate: { $lt: todayStart },
          },
        },
        { $unwind: "$assigneeIds" },
        { $match: { assigneeIds: { $in: eligibleOids } } },
        { $group: { _id: "$assigneeIds", count: { $sum: 1 } } },
      ]),
      Task.find({
        workspaceId: ws._id,
        isArchived: false,
        status: { $ne: "DONE" },
        dueDate: { $lt: todayStart },
      })
        .select("title projectId")
        .sort({ dueDate: 1 })
        .limit(5)
        .lean(),
    ]);

    // Project names for overdue list
    const overdueProjectIds = [...new Set(overdueList.map((t) => String(t.projectId)))];
    const overdueProjects = await Project.find({ _id: { $in: overdueProjectIds } })
      .select("name")
      .lean();
    const projectMap = new Map(overdueProjects.map((p) => [String(p._id), p.name]));

    const overdueListForEmail = overdueList.map((t) => ({
      title: t.title,
      projectName: projectMap.get(String(t.projectId)) ?? "Unknown project",
    }));

    // Top 3 most-active members (by completed tasks)
    const topMemberRows = [...completedAgg]
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    const topMemberUserIds = topMemberRows.map((r) => r._id);
    const topMemberUsers = await User.find({ _id: { $in: topMemberUserIds } })
      .select("name")
      .lean();
    const topMembers = topMemberRows.map((r) => ({
      name: topMemberUsers.find((u) => String(u._id) === String(r._id))?.name ?? "Unknown",
      count: r.count,
    }));

    // Per-user maps
    const completedMap = new Map(completedAgg.map((r) => [String(r._id), r.count]));
    const openMap = new Map(openAgg.map((r) => [String(r._id), r.count]));
    const overdueCountMap = new Map(overdueCountAgg.map((r) => [String(r._id), r.count]));

    const users = await User.find({ _id: { $in: eligibleIds }, isActive: true })
      .select("email name")
      .lean();

    for (const u of users) {
      if (!u.email) continue;
      const uidStr = String(u._id);
      const completed = completedMap.get(uidStr) ?? 0;
      const open = openMap.get(uidStr) ?? 0;
      const overdue = overdueCountMap.get(uidStr) ?? 0;
      if (completed === 0 && open === 0 && overdue === 0) continue;

      enqueue("weekly-digest-email", {
        email: u.email,
        userName: u.name,
        workspaceName: ws.name,
        workspaceUrl: absoluteUrl(`/w/${ws.slug}`),
        completedThisWeek: completed,
        openTasks: open,
        overdueTasks: overdue,
        overdueList: overdueListForEmail,
        topMembers,
      });
      sent++;
    }
  }

  return { sent };
}
