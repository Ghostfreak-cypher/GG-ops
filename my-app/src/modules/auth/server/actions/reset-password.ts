"use server";

import bcrypt from "bcryptjs";
import type { ActionResult } from "@/lib/action-result";
import { rateLimit } from "@/lib/rate-limit";
import { resetPasswordSchema } from "@/modules/auth/schemas";
import { consumePasswordResetToken } from "@/lib/auth-security";

export async function resetPasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const limited = await rateLimit(`reset-password:${parsed.data.token}`, 10, 3600);
  if (!limited.allowed) return { ok: false, error: "Too many attempts. Try again later." };

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const userId = await consumePasswordResetToken(parsed.data.token, passwordHash);
  if (!userId) return { ok: false, error: "This reset link is invalid or expired." };

  return { ok: true };
}
