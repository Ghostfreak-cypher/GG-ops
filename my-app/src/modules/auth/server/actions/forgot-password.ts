"use server";

import { connectDB } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import type { ActionResult } from "@/lib/action-result";
import { User } from "@/models/User";
import { forgotPasswordSchema } from "@/modules/auth/schemas";
import { normalizeEmail, sendPasswordResetEmail } from "@/lib/auth-security";

const SUCCESS_MESSAGE = "If an account exists for that email, a reset link has been sent.";

export async function requestPasswordResetAction(input: unknown): Promise<ActionResult<{ message: string }>> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const email = normalizeEmail(parsed.data.email);
  const perEmail = await rateLimit(`forgot-password:email:${email}`, 5, 3600);
  const perIp = await rateLimit(`forgot-password:ip:${email}`, 20, 3600);
  if (!perEmail.allowed || !perIp.allowed) return { ok: true, data: { message: SUCCESS_MESSAGE } };

  await connectDB();
  const user = await User.findOne({ email }).select("_id passwordHash").lean();
  if (user?._id && user.passwordHash) {
    await sendPasswordResetEmail(String(user._id));
  }

  return { ok: true, data: { message: SUCCESS_MESSAGE } };
}
