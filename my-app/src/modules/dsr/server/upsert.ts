import { format } from "date-fns";
import { connectDB } from "@/lib/db";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { DailyStatusReport } from "@/models/DailyStatusReport";
import { canSubmitDsr } from "@/modules/workspace/server/permissions";
import { logActivity } from "@/modules/activity/log";
import { upsertDsrSchema } from "@/modules/dsr/schemas";
import { toDsrDTO, type DsrDTO, type DsrPersisted } from "@/modules/dsr/server/dto";
import { collectTaskIds, resolveLinkedTasks } from "@/modules/dsr/server/linked-tasks";
import type { WorkspaceRole } from "@/modules/workspace/roles";
import type { ActionResult } from "@/lib/action-result";

/**
 * Filing a report, with the caller already resolved. Two entry points reach these: the Server
 * Action, which resolves the caller from the session, and the MCP connector route, which
 * resolves them from a signed token. The rules that make a report correct — the total is
 * derived not accepted, no future dates, one row per person per day — live here so the two
 * paths cannot drift apart.
 *
 * `ctx` is the authenticated caller. Nothing identifying is ever read from `input`: it carries
 * the report's content and which day it is about, and that is all.
 */
export type DsrAuthor = {
  workspaceId: string;
  userId: string;
  userName: string;
  role: WorkspaceRole;
};

/** The day the app considers "today" — server-local, matching every other DSR surface. */
export function todayKey(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export async function upsertDsrFor(
  ctx: DsrAuthor,
  input: unknown,
): Promise<ActionResult<DsrDTO>> {
  if (!canSubmitDsr(ctx.role)) {
    return { ok: false, error: "Guests can't file daily status reports." };
  }

  const parsed = upsertDsrSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { date, entries, tomorrowPlan } = parsed.data;
  if (date > todayKey()) {
    return { ok: false, error: "You can't file a report for a future date." };
  }

  // Derived here, never read from `input` — the caller sends rows, not a total.
  const totalMinutes = entries.reduce((sum, e) => sum + e.minutes, 0);

  await connectDB();

  // Linked tasks are the one part of `input` that names something outside this report, so
  // it's the one part that needs authorizing. The lookup is scoped to the author's own
  // workspace, so an id from anywhere else simply doesn't come back — without this a
  // caller could link a task they can't see and read its title back out of the DTO.
  // Both writers (the Server Action and the MCP tool) funnel through here, so neither can
  // skip it. The resolved rows are reused for the returned DTO rather than re-queried.
  const taskIds = collectTaskIds(entries);
  const taskById = await resolveLinkedTasks(ctx.workspaceId, taskIds);
  if (taskById.size !== taskIds.length) {
    return { ok: false, error: "One of the linked tasks isn't in this workspace." };
  }

  // workspaceId/userId/date come from the filter and are written by the upsert itself —
  // repeating them in $setOnInsert would conflict on the same paths.
  const doc = await DailyStatusReport.findOneAndUpdate(
    {
      workspaceId: parseObjectIdOrThrow(ctx.workspaceId),
      userId: parseObjectIdOrThrow(ctx.userId),
      date,
    },
    // $set replaces the whole array rather than merging into it, so a row removed while
    // editing is actually gone instead of surviving underneath the shorter list.
    { $set: { entries, totalMinutes, tomorrowPlan } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  ).lean();

  await logActivity({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "DSR_SUBMITTED",
    metadata: { date, totalMinutes },
  });

  return { ok: true, data: toDsrDTO(doc as unknown as DsrPersisted, ctx.userName, taskById) };
}
