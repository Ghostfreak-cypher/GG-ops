"use server";

import bcrypt from "bcryptjs";
import type { ActionResult } from "@/lib/action-result";
import { connectDB } from "@/lib/db";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { rateLimit } from "@/lib/rate-limit";
import { User } from "@/models/User";
import { requireUser } from "@/modules/auth/server/session";
import { changePasswordSchema } from "@/modules/auth/schemas";
import { bumpAuthVersion, sendPasswordChangedEmail } from "@/lib/auth-security";

export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const limited = await rateLimit(`change-password:${user.id}`, 5, 3600);
  if (!limited.allowed) return { ok: false, error: "Too many attempts. Try again later." };

  await connectDB();
  const dbUser = await User.findById(parseObjectIdOrThrow(user.id)).select("passwordHash");
  if (!dbUser?.passwordHash) return { ok: false, error: "Password sign-in is not enabled for this account." };

  const valid = await bcrypt.compare(parsed.data.currentPassword, dbUser.passwordHash);
  if (!valid) return { ok: false, error: "Current password is incorrect." };

  const nextHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await bumpAuthVersion(user.id, nextHash);
  await sendPasswordChangedEmail(user.id);

  return { ok: true };
}
