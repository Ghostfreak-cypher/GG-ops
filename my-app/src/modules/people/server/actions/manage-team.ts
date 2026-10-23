"use server";

import { z } from "zod";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { isValidObjectId } from "@/lib/mongo/ids";
import { Team } from "@/models/Team";
import { WorkspaceMember } from "@/models/WorkspaceMember";
import { requireUser } from "@/modules/auth/server/session";
import { getWorkspaceForUser } from "@/modules/workspace/server/queries";
import { canManageMembers } from "@/modules/workspace/server/permissions";
import { revalidatePath } from "next/cache";

const createTeamSchema = z.object({
  name: z.string().min(1).max(80).trim(),
  description: z.string().max(300).trim().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#000000"),
  isPrivate: z.boolean().default(false),
});

const updateTeamSchema = createTeamSchema.partial();

export async function createTeamAction(
  slug: string,
  data: z.infer<typeof createTeamSchema>,
): Promise<{ ok: true; teamId: string } | { ok: false; error: string }> {
  const user = await requireUser();
  const ws = await getWorkspaceForUser(slug, user.id);
  if (!ws) return { ok: false, error: "Workspace not found." };
  if (!canManageMembers(ws.role)) return { ok: false, error: "Insufficient permissions." };

  const parsed = createTeamSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  await connectDB();
  const team = await Team.create({
    workspaceId: new Types.ObjectId(ws.id),
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    color: parsed.data.color,
    isPrivate: parsed.data.isPrivate,
    memberIds: [new Types.ObjectId(user.id)],
    leadIds: [new Types.ObjectId(user.id)],
    createdBy: new Types.ObjectId(user.id),
  });

  revalidatePath(`/w/${slug}/people/teams`);
  return { ok: true, teamId: String(team._id) };
}

export async function updateTeamAction(
  slug: string,
  teamId: string,
  data: z.infer<typeof updateTeamSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const ws = await getWorkspaceForUser(slug, user.id);
  if (!ws) return { ok: false, error: "Workspace not found." };
  if (!canManageMembers(ws.role)) return { ok: false, error: "Insufficient permissions." };

  const parsed = updateTeamSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  await connectDB();
  await Team.findOneAndUpdate(
    { _id: new Types.ObjectId(teamId), workspaceId: new Types.ObjectId(ws.id) },
    { $set: parsed.data },
  );

  revalidatePath(`/w/${slug}/people/teams`);
  revalidatePath(`/w/${slug}/people/teams/${teamId}`);
  return { ok: true };
}

export async function deleteTeamAction(
  slug: string,
  teamId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const ws = await getWorkspaceForUser(slug, user.id);
  if (!ws) return { ok: false, error: "Workspace not found." };
  if (!canManageMembers(ws.role)) return { ok: false, error: "Insufficient permissions." };

  await connectDB();
  await Team.findOneAndDelete({
    _id: new Types.ObjectId(teamId),
    workspaceId: new Types.ObjectId(ws.id),
  });

  revalidatePath(`/w/${slug}/people/teams`);
  return { ok: true };
}

export async function addTeamMemberAction(
  slug: string,
  teamId: string,
  userId: string,
  asLead = false,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const ws = await getWorkspaceForUser(slug, user.id);
  if (!ws) return { ok: false, error: "Workspace not found." };
  if (!canManageMembers(ws.role)) return { ok: false, error: "Insufficient permissions." };
  if (!isValidObjectId(teamId) || !isValidObjectId(userId)) return { ok: false, error: "Invalid input." };

  // Verify the target user is actually a workspace member
  await connectDB();
  const membership = await WorkspaceMember.findOne({
    workspaceId: new Types.ObjectId(ws.id),
    userId: new Types.ObjectId(userId),
    status: "ACTIVE",
  }).lean();
  if (!membership) return { ok: false, error: "User is not a workspace member." };

  const uid = new Types.ObjectId(userId);
  const addToSet: Record<string, unknown> = { memberIds: uid };
  if (asLead) addToSet.leadIds = uid;

  await Team.findOneAndUpdate(
    { _id: new Types.ObjectId(teamId), workspaceId: new Types.ObjectId(ws.id) },
    { $addToSet: addToSet },
  );

  revalidatePath(`/w/${slug}/people/teams/${teamId}`);
  return { ok: true };
}

export async function removeTeamMemberAction(
  slug: string,
  teamId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const ws = await getWorkspaceForUser(slug, user.id);
  if (!ws) return { ok: false, error: "Workspace not found." };
  if (!canManageMembers(ws.role)) return { ok: false, error: "Insufficient permissions." };
  if (!isValidObjectId(teamId) || !isValidObjectId(userId)) return { ok: false, error: "Invalid input." };

  await connectDB();
  await Team.findOneAndUpdate(
    { _id: new Types.ObjectId(teamId), workspaceId: new Types.ObjectId(ws.id) },
    {
      $pull: {
        memberIds: new Types.ObjectId(userId),
        leadIds: new Types.ObjectId(userId),
      },
    },
  );

  revalidatePath(`/w/${slug}/people/teams/${teamId}`);
  return { ok: true };
}
