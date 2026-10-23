/**
 * Demo seed: a few days of Daily Status Reports so the roster and history views have
 * something real to show.
 *
 * Usage (from my-app/):
 *   npm run db:seed-dsr
 *   DSR_WS_SLUG=other-slug npm run db:seed-dsr
 *
 * Deliberately leaves gaps: one person files every day, another misses the last two.
 * The roster's whole job is showing who *hasn't* filed, so a fully-populated month would
 * demo the one state that never matters.
 *
 * Idempotent — upserts on `{workspaceId, userId, date}`, the same unique index the real
 * write path uses, so re-running edits rather than duplicating. `totalMinutes` is derived
 * here exactly as `upsertDsrFor` derives it; never hand-written.
 */
try {
  (process as unknown as { loadEnvFile?: (p: string) => void }).loadEnvFile?.(".env.local");
} catch {
  /* env may already be set in the shell */
}

import mongoose from "mongoose";
import { format } from "date-fns";
import { DailyStatusReport } from "@/models/DailyStatusReport";
import { Workspace } from "@/models/Workspace";
import { WorkspaceMember } from "@/models/WorkspaceMember";
import { User } from "@/models/User";
import { canSubmitDsr } from "@/modules/workspace/server/permissions";
import type { WorkspaceRole } from "@/modules/workspace/roles";

const MONGODB_URI = process.env.MONGODB_URI;
const WS_SLUG = process.env.DSR_WS_SLUG ?? "genegeniius-sprint";

type Entry = { task: string; minutes: number };
type DayPlan = { daysAgo: number; entries: Entry[]; tomorrowPlan: string };

/**
 * Older days, cycled to give the history enough depth to page through — the list renders
 * seven at a time, so five reports would never show a second page.
 */
const ROUTINE: { entries: Entry[]; tomorrowPlan: string }[] = [
  {
    entries: [
      { task: "Board polish: drag handles and the empty-column state", minutes: 195 },
      { task: "Triaged the overnight Sentry batch", minutes: 45 },
    ],
    tomorrowPlan: "Pick up the notification digest job.",
  },
  {
    entries: [
      { task: "Notification digest: batching window and the unsubscribe path", minutes: 240 },
      { task: "Sprint planning", minutes: 60 },
    ],
    tomorrowPlan: "Finish the digest, then look at attachment uploads.",
  },
  {
    entries: [
      { task: "Attachment uploads: S3 presign + the size guard", minutes: 210 },
      { task: "Reviewed Faraz's workspace-invite PR", minutes: 50 },
      { task: "Stand-up", minutes: 15 },
    ],
    tomorrowPlan: "Wire the upload progress UI.",
  },
  {
    entries: [{ task: "Search: workspace-scoped task index and the ranking pass", minutes: 300 }],
    tomorrowPlan: "Benchmark search against the seeded workspace.",
  },
  {
    entries: [
      { task: "Cut the release, watched the deploy", minutes: 90 },
      { task: "Documented the API key rotation runbook", minutes: 120 },
      { task: "Pairing on the calendar view", minutes: 75 },
    ],
    tomorrowPlan: "Back to the board polish backlog.",
  },
];

/** `count` routine days, starting `from` days ago and going further back. */
function routineDays(from: number, count: number): DayPlan[] {
  return Array.from({ length: count }, (_, i) => ({
    daysAgo: from + i,
    ...ROUTINE[i % ROUTINE.length],
  }));
}

/** Filed every day, including today — the "up to date" row on the roster. */
const DILIGENT: DayPlan[] = [
  {
    daysAgo: 0,
    entries: [
      { task: "Ported the DSR module and stripped the sales branching", minutes: 180 },
      { task: "Wired submit_dsr and get_dsr into the MCP registry", minutes: 90 },
      { task: "Stand-up and plan review", minutes: 30 },
    ],
    tomorrowPlan: "Walk through the Phase 8 checklist and hand over the evidence.",
  },
  {
    daysAgo: 1,
    entries: [
      { task: "Confirm queue: badges, row actions, empty state", minutes: 240 },
      { task: "Reviewed the name-map fuzzy threshold with Shrinjay", minutes: 45 },
    ],
    tomorrowPlan: "Start the DSR port — Phase 0 pre-flight first.",
  },
  {
    daysAgo: 2,
    entries: [
      { task: "Slip counter + evidence gate on the task update path", minutes: 200 },
      { task: "Backfilled the status enum migration and dry-ran it", minutes: 75 },
      { task: "Paired with Sagar on the MCP service account", minutes: 60 },
    ],
    tomorrowPlan: "Build the confirm view on top of the unconfirmed rows.",
  },
  {
    daysAgo: 3,
    entries: [
      { task: "Schema work: five ledger fields and the seven-status enum", minutes: 285 },
      { task: "Wrote the guards tests before touching update-task", minutes: 60 },
    ],
    tomorrowPlan: "Finish the slip counter and the done-without-evidence gate.",
  },
  {
    daysAgo: 4,
    entries: [
      { task: "Answered the four unknowns against the live database", minutes: 210 },
      { task: "Wrote up B1 and shared it with Faraz and Shrinjay", minutes: 90 },
    ],
    tomorrowPlan: "Start B2 — schema, status enum, slip logic.",
  },
  // Deep enough that the previous month is fully populated: the current month only has as
  // many days as have elapsed, so early in a month it can't show a second page at all.
  ...routineDays(5, 30),
];

/** Filed early in the week, then stopped — the row a maintainer is meant to notice. */
const LAPSED: DayPlan[] = [
  {
    daysAgo: 2,
    entries: [
      { task: "Infra: provisioned the staging cluster", minutes: 195 },
      { task: "Debugged the Atlas connection pool warnings", minutes: 105 },
    ],
    tomorrowPlan: "Finish the pool tuning, then look at the backup cadence.",
  },
  {
    daysAgo: 3,
    entries: [
      { task: "M6 rollout checks", minutes: 150 },
      { task: "Reviewed Vansh's API key lifecycle PR", minutes: 60 },
    ],
    tomorrowPlan: "Staging cluster provisioning.",
  },
  {
    daysAgo: 4,
    entries: [{ task: "Incident follow-up: the 3am pager on M7", minutes: 240 }],
    tomorrowPlan: "Write the postmortem, then back to M6.",
  },
];

/**
 * The maintainer files too, so they get a history of their own — review and planning work
 * rather than the delivery pool, so two people never show the same task text on one day.
 *
 * Deliberately starts yesterday and never covers today: their own roster row then reads
 * "Pending", which is the whole point of putting maintainers on the roster.
 */
const MAINTAINER: DayPlan[] = [
  {
    daysAgo: 1,
    entries: [
      { task: "Reviewed the DSR filter and paging PR", minutes: 90 },
      { task: "1:1s with Sagar and Engineer", minutes: 60 },
      { task: "Roadmap pass on the CRM pipeline gaps", minutes: 120 },
    ],
    tomorrowPlan: "Decide whether admins should read the whole team's DSR.",
  },
  {
    daysAgo: 2,
    entries: [
      { task: "Cut scope for the one-day build and wrote it up", minutes: 150 },
      { task: "Interviewed for the infra role", minutes: 60 },
    ],
    tomorrowPlan: "Review the DSR paging work, then roadmap.",
  },
  {
    daysAgo: 3,
    entries: [
      { task: "Budget review with finance on the spend report", minutes: 105 },
      { task: "Unblocked the MCP service-account rollout", minutes: 75 },
    ],
    tomorrowPlan: "Scope the one-day build.",
  },
  {
    daysAgo: 4,
    entries: [{ task: "Quarter planning offsite", minutes: 420 }],
    tomorrowPlan: "Budget review, then unblock the MCP rollout.",
  },
];

/** Who gets which pattern. Anyone not listed simply files nothing — also a valid demo state. */
const PLANS: { email: string; days: DayPlan[] }[] = [
  { email: "engineer@smoke.test", days: DILIGENT },
  { email: "sagar@smoke.test", days: LAPSED },
  { email: "vansh@smoke.test", days: MAINTAINER },
];

function dateKey(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return format(d, "yyyy-MM-dd");
}

async function main() {
  if (!MONGODB_URI || MONGODB_URI.includes("placeholder")) {
    console.error("Set a real MONGODB_URI in my-app/.env.local (or your shell) before seeding.");
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);

  const workspace = await Workspace.findOne({ slug: WS_SLUG }).select("_id name").lean();
  if (!workspace) {
    console.error(`No workspace with slug "${WS_SLUG}". Set DSR_WS_SLUG.`);
    process.exit(1);
  }

  let written = 0;
  for (const { email, days } of PLANS) {
    const user = await User.findOne({ email }).select("_id name").lean();
    if (!user) {
      console.warn(`  skip ${email} — no such user`);
      continue;
    }

    // The roster only lists people who owe a report, so seeding one for anyone else would
    // create a row nothing ever renders.
    const membership = await WorkspaceMember.findOne({
      workspaceId: workspace._id,
      userId: user._id,
      status: "ACTIVE",
    })
      .select("role")
      .lean();
    if (!membership || !canSubmitDsr(membership.role as WorkspaceRole)) {
      console.warn(`  skip ${email} — not an active member who files reports`);
      continue;
    }

    for (const day of days) {
      const totalMinutes = day.entries.reduce((sum, e) => sum + e.minutes, 0);
      await DailyStatusReport.findOneAndUpdate(
        { workspaceId: workspace._id, userId: user._id, date: dateKey(day.daysAgo) },
        { $set: { entries: day.entries, totalMinutes, tomorrowPlan: day.tomorrowPlan } },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
      );
      written += 1;
    }
    console.log(`  ${user.name} <${email}> — ${days.length} report(s)`);
  }

  console.log(`\nSeeded ${written} report(s) into "${workspace.name}".`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
