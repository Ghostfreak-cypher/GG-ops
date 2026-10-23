import { cache } from "react";
import { connectDB } from "@/lib/db";
import { Label } from "@/models/Label";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";

export type LabelDTO = { id: string; name: string; color: string | null };

export const listLabels = cache(async (workspaceId: string): Promise<LabelDTO[]> => {
  await connectDB();
  const labels = await Label.find({ workspaceId: parseObjectIdOrThrow(workspaceId) })
    .sort({ name: 1 })
    .lean();
  return labels.map((l) => ({ id: String(l._id), name: l.name, color: l.color ?? null }));
});
