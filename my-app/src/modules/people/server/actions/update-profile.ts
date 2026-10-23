"use server";

import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { requireUser } from "@/modules/auth/server/session";
import { revalidatePath } from "next/cache";

const profileSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  jobTitle: z.string().max(100).trim().nullable().optional(),
  department: z.string().max(100).trim().nullable().optional(),
  bio: z.string().max(500).trim().nullable().optional(),
  pronounceUrl: z.string().url().nullable().optional().or(z.literal("")),
  outOfOfficeEnabled: z.boolean().optional(),
  outOfOfficeFrom: z.string().nullable().optional(),
  outOfOfficeUntil: z.string().nullable().optional(),
  outOfOfficeMessage: z.string().max(300).trim().nullable().optional(),
});

export type ProfileFormData = z.infer<typeof profileSchema>;

export async function updateProfileAction(
  data: ProfileFormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  await connectDB();
  await User.findByIdAndUpdate(user.id, {
    name: parsed.data.name,
    jobTitle: parsed.data.jobTitle ?? null,
    department: parsed.data.department ?? null,
    bio: parsed.data.bio ?? null,
    pronounceUrl: parsed.data.pronounceUrl || null,
    outOfOfficeEnabled: parsed.data.outOfOfficeEnabled ?? false,
    outOfOfficeFrom: parsed.data.outOfOfficeFrom ? new Date(parsed.data.outOfOfficeFrom) : null,
    outOfOfficeUntil: parsed.data.outOfOfficeUntil ? new Date(parsed.data.outOfOfficeUntil) : null,
    outOfOfficeMessage: parsed.data.outOfOfficeMessage ?? null,
  });

  revalidatePath("/account/profile");
  return { ok: true };
}
