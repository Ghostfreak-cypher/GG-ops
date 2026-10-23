"use server";

import type { ActionResult } from "@/lib/action-result";
import { rateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/modules/auth/server/session";
import { resendVerificationSchema } from "@/modules/auth/schemas";
import { consumeVerificationToken, hashToken, sendVerificationEmail } from "@/lib/auth-security";

export async function verifyEmailAction(token: string): Promise<ActionResult> {
  // Keyed on the token's hash: rate-limit keys are stored in Redis and logged on failure.
  const limited = await rateLimit(`verify-email:${hashToken(token)}`, 10, 3600);
  if (!limited.allowed) return { ok: false, error: "Too many attempts. Try again later." };

  const userId = await consumeVerificationToken(token);
  if (!userId) return { ok: false, error: "This verification link is invalid or expired." };
  return { ok: true };
}

export async function sendVerificationEmailAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = resendVerificationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  if (parsed.data.userId !== user.id) return { ok: false, error: "Not allowed." };

  const limited = await rateLimit(`verify-email-resend:${user.id}`, 3, 3600);
  if (!limited.allowed) return { ok: false, error: "Too many attempts. Try again later." };

  await sendVerificationEmail(user.id);
  return { ok: true };
}
