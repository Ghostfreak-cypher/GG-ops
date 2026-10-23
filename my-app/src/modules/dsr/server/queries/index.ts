import { cache } from "react";
import { connectDB } from "@/lib/db";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { DailyStatusReport } from "@/models/DailyStatusReport";
import { User } from "@/models/User";
import { listMembers } from "@/modules/workspace/server/queries";
import { canSubmitDsr } from "@/modules/workspace/server/permissions";
import type { WorkspaceRole } from "@/modules/workspace/roles";
import { monthBounds, dsrDateCondition, type DsrWindow } from "@/modules/dsr/date-window";
import { toDsrDTO, type DsrDTO, type DsrPersisted, type DsrRosterEntryDTO } from "@/modules/dsr/server/dto";
import { collectTaskIds, resolveLinkedTasks } from "@/modules/dsr/server/linked-tasks";

/**
 * Gather distinct authors and linked tasks -> fetch each once -> map in memory (no populate).
 *
 * `workspaceId` is passed rather than read off the rows so the task lookup is scoped by the
 * same value the caller already authorized — a linked task from anywhere else resolves to
 * nothing and the entry renders as plain text.
 */
async function toDTOs(rows: DsrPersisted[], workspaceId: string): Promise<DsrDTO[]> {
  const userIds = [...new Set(rows.map((r) => String(r.userId)))];
  const [users, taskById] = await Promise.all([
    userIds.length ? User.find({ _id: { $in: userIds } }).select("name").lean() : [],
    resolveLinkedTasks(workspaceId, collectTaskIds(rows.flatMap((r) => r.entries))),
  ]);
  const nameById = new Map(users.map((u) => [String(u._id), u.name]));

  return rows.map((r) => toDsrDTO(r, nameById.get(String(r.userId)) ?? "Unknown", taskById));
}

/** A single day's report for one person — prefills the form when today is already filed. */
export async function getMyDsrForDate(
  workspaceId: string,
  userId: string,
  date: string,
): Promise<DsrDTO | null> {
  await connectDB();
  const row = await DailyStatusReport.findOne({
    workspaceId: parseObjectIdOrThrow(workspaceId),
    userId: parseObjectIdOrThrow(userId),
    date,
  }).lean();
  if (!row) return null;

  const [dto] = await toDTOs([row as unknown as DsrPersisted], workspaceId);
  return dto;
}

/**
 * One page of somebody's history, newest first, plus the totals for the whole window.
 *
 * The totals describe the window rather than the page: the header says how much was filed
 * that month, and only some of it is on screen.
 */
export type DsrPage = {
  dsrs: DsrDTO[];
  hasMore: boolean;
  total: number;
  totalMinutes: number;
};

/** One person's own reports. */
export async function getMyDsrPage(
  workspaceId: string,
  userId: string,
  window: DsrWindow,
  take: number,
): Promise<DsrPage> {
  return getDsrPageForUser(workspaceId, userId, window, take);
}

/**
 * One member's reports — what a team-DSR reader opens after clicking a name. Identical query to
 * `getMyDsrPage`; kept as a separate name because the callers are authorized differently and
 * the read paths shouldn't look interchangeable.
 */
export async function getMemberDsrPage(
  workspaceId: string,
  userId: string,
  window: DsrWindow,
  take: number,
): Promise<DsrPage> {
  return getDsrPageForUser(workspaceId, userId, window, take);
}

type TotalsRow = { total: number; totalMinutes: number };

async function getDsrPageForUser(
  workspaceId: string,
  userId: string,
  window: DsrWindow,
  take: number,
): Promise<DsrPage> {
  await connectDB();
  const match = {
    workspaceId: parseObjectIdOrThrow(workspaceId),
    userId: parseObjectIdOrThrow(userId),
    date: dsrDateCondition(window),
  };

  const [rows, [totals]] = await Promise.all([
    // Reading one row past the page is the "is there more" test — cheaper than a second
    // count, and the sort walks {workspaceId, userId, date} backwards either way.
    DailyStatusReport.find(match)
      .sort({ date: -1 })
      .limit(take + 1)
      .lean(),
    DailyStatusReport.aggregate<TotalsRow>([
      { $match: match },
      { $group: { _id: null, total: { $sum: 1 }, totalMinutes: { $sum: "$totalMinutes" } } },
    ]),
  ]);

  const hasMore = rows.length > take;

  return {
    dsrs: await toDTOs(
      (hasMore ? rows.slice(0, take) : rows) as unknown as DsrPersisted[],
      workspaceId,
    ),
    hasMore,
    // An empty window yields no group document at all, rather than a row of zeroes.
    total: totals?.total ?? 0,
    totalMinutes: totals?.totalMinutes ?? 0,
  };
}

type RosterAggregateRow = {
  _id: unknown;
  reports: number;
  lastDate: string;
};

/**
 * Every member who is expected to file, with their month summarized.
 *
 * Members with no reports are kept as zero rows — the point of this page is seeing who
 * hasn't filed, so dropping them would hide exactly what the reader is looking for.
 *
 * Everyone who can file is listed, which is the whole active team apart from guests — the
 * admins and the maintainer reading this page included. Seeing your own row here is the
 * point, not a gap.
 */
export const getDsrRoster = cache(
  async (
    workspaceId: string,
    month: string,
    today: string,
  ): Promise<DsrRosterEntryDTO[]> => {
    await connectDB();
    const wsId = parseObjectIdOrThrow(workspaceId);
    const { from, to } = monthBounds(month);

    const [members, totals, filedToday] = await Promise.all([
      listMembers(workspaceId),
      DailyStatusReport.aggregate<RosterAggregateRow>([
        { $match: { workspaceId: wsId, date: { $gte: from, $lt: to } } },
        { $group: { _id: "$userId", reports: { $sum: 1 }, lastDate: { $max: "$date" } } },
      ]),
      DailyStatusReport.distinct("userId", { workspaceId: wsId, date: today }),
    ]);

    const totalsByUser = new Map(totals.map((r) => [String(r._id), r]));
    const filedTodayIds = new Set(filedToday.map(String));

    return members
      // Derived from the predicate rather than a hand-written role comparison: the roster
      // must list exactly the people who owe a report, and the two can't be allowed to drift.
      .filter((m) => m.status === "ACTIVE" && canSubmitDsr(m.role as WorkspaceRole))
      .map((m) => {
        const totalsForUser = totalsByUser.get(m.userId);
        return {
          userId: m.userId,
          name: m.name,
          email: m.email,
          image: m.image,
          jobTitle: m.jobTitle,
          role: m.role,
          reportsThisMonth: totalsForUser?.reports ?? 0,
          lastReportDate: totalsForUser?.lastDate ?? null,
          submittedToday: filedTodayIds.has(m.userId),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  },
);
