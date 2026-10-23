import { connectDB } from "@/lib/db";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { NotificationPreference, type DigestFrequency } from "@/models/NotificationPreference";
import type { WorkspaceEmailEvent, WorkspaceEmailFrequency } from "@/lib/notification-preferences-types";

export type { WorkspaceEmailEvent, WorkspaceEmailFrequency };
export { WORKSPACE_EMAIL_EVENT_LABELS } from "@/lib/notification-preferences-types";

const DEFAULT_EVENT_FREQUENCY: Record<WorkspaceEmailEvent, WorkspaceEmailFrequency> = {
  INVITE: "IMMEDIATE",
  WORKSPACE_JOINED: "IMMEDIATE",
  ROLE_UPDATED: "IMMEDIATE",
  TASK_ASSIGNED: "IMMEDIATE",
  TASK_DUE: "IMMEDIATE",
  TASK_DUE_TOMORROW: "IMMEDIATE",
  TASK_OVERDUE: "IMMEDIATE",
  TASK_COMPLETED: "IMMEDIATE",
  TASK_COMMENTED: "IMMEDIATE",
  COMMENT_MENTION: "IMMEDIATE",
  MEMBER_JOINED: "IMMEDIATE",
  DIGEST_DAILY: "DAILY",
  DIGEST_WEEKLY: "WEEKLY",
};

function mapDigestToEventFrequency(digest: DigestFrequency): Partial<Record<WorkspaceEmailEvent, WorkspaceEmailFrequency>> {
  if (digest === "NONE") return { DIGEST_DAILY: "OFF", DIGEST_WEEKLY: "OFF" };
  if (digest === "WEEKLY") return { DIGEST_DAILY: "OFF", DIGEST_WEEKLY: "WEEKLY" };
  return { DIGEST_DAILY: "DAILY", DIGEST_WEEKLY: "WEEKLY" };
}

function mapEventFrequencyToDigest(
  prefs: Partial<Record<WorkspaceEmailEvent, WorkspaceEmailFrequency>>,
  fallback: DigestFrequency,
): DigestFrequency {
  const daily = prefs.DIGEST_DAILY;
  const weekly = prefs.DIGEST_WEEKLY;
  if (daily === "OFF" && weekly === "OFF") return "NONE";
  if (daily === "OFF" && weekly === "WEEKLY") return "WEEKLY";
  if (daily === "DAILY") return "DAILY";
  return fallback;
}

export async function listWorkspaceEmailPreferences(
  userId: string,
  workspaceId: string,
): Promise<Record<WorkspaceEmailEvent, WorkspaceEmailFrequency>> {
  await connectDB();
  const row = await NotificationPreference.findOne({
    userId: parseObjectIdOrThrow(userId),
    workspaceId: parseObjectIdOrThrow(workspaceId),
  }).lean();

  const prefs = { ...DEFAULT_EVENT_FREQUENCY, ...mapDigestToEventFrequency((row?.emailDigest as DigestFrequency | undefined) ?? "DAILY") };
  for (const item of row?.preferences ?? []) {
    prefs[item.event as WorkspaceEmailEvent] = item.frequency as WorkspaceEmailFrequency;
  }
  return prefs;
}

export async function saveWorkspaceEmailPreferences(
  userId: string,
  workspaceId: string,
  updates: Partial<Record<WorkspaceEmailEvent, WorkspaceEmailFrequency>>,
): Promise<void> {
  await connectDB();
  const current = await listWorkspaceEmailPreferences(userId, workspaceId);
  const next = { ...current, ...updates };
  const emailDigest = mapEventFrequencyToDigest(next, "DAILY");
  const preferences = Object.entries(next).map(([event, frequency]) => ({ event, frequency }));

  await NotificationPreference.updateOne(
    {
      userId: parseObjectIdOrThrow(userId),
      workspaceId: parseObjectIdOrThrow(workspaceId),
    },
    {
      $set: {
        emailDigest,
        preferences,
      },
    },
    { upsert: true },
  );
}

export async function canSendWorkspaceEmail(
  userId: string,
  workspaceId: string,
  event: WorkspaceEmailEvent,
  desiredFrequency: WorkspaceEmailFrequency = "IMMEDIATE",
): Promise<boolean> {
  const prefs = await listWorkspaceEmailPreferences(userId, workspaceId);
  const current = prefs[event];
  if (current === "OFF") return false;
  if (current === desiredFrequency) return true;
  if (desiredFrequency === "IMMEDIATE") return current === "IMMEDIATE";
  return current === desiredFrequency;
}
