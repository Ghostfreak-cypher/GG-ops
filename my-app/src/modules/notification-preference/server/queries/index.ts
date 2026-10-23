import { cache } from "react";
import { connectDB } from "@/lib/db";
import { NotificationPreference, type DigestFrequency } from "@/models/NotificationPreference";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";

export const getEmailDigestPreference = cache(
  async (userId: string, workspaceId: string): Promise<DigestFrequency> => {
    await connectDB();
    const pref = await NotificationPreference.findOne({
      userId: parseObjectIdOrThrow(userId),
      workspaceId: parseObjectIdOrThrow(workspaceId),
    })
      .select("emailDigest")
      .lean();
    return (pref?.emailDigest as DigestFrequency | undefined) ?? "DAILY";
  },
);
