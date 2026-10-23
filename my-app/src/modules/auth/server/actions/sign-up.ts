"use server";

import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { WorkspaceInvite } from "@/models/WorkspaceInvite";
import { signUpSchema } from "@/modules/workspace/schemas";
import { isInviteExpired } from "@/modules/workspace/invites";
import { joinWorkspaceViaInvite } from "@/modules/workspace/server/actions/join-via-invite";
import { enqueue } from "@/lib/queue";
import { absoluteUrl } from "@/lib/urls";
import type { ActionResult } from "@/lib/action-result";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeEmail, sendVerificationEmail } from "@/lib/auth-security";

export async function signUpAction(
  input: unknown,
): Promise<ActionResult<{ workspaceSlug: string }>> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { name, email, password, inviteToken } = parsed.data;
  await connectDB();

  // When signing up from an invite, the invite's email is authoritative — the
  // new account is created under exactly the address that was invited.
  let inviteEmail: string | null = null;
  if (inviteToken) {
    const invite = await WorkspaceInvite.findOne({ token: inviteToken })
      .select("email acceptedAt expiresAt")
      .lean();
    if (invite && !invite.acceptedAt && !isInviteExpired(invite.expiresAt)) {
      inviteEmail = invite.email;
    }
  }

  const normalizedEmail = inviteEmail ?? normalizeEmail(email);
  const limited = await rateLimit(`signup:${normalizedEmail}`, 5, 3600);
  if (!limited.allowed) return { ok: false, error: "Too many sign-up attempts. Try again later." };

  const existing = await User.findOne({ email: normalizedEmail }).select("_id").lean();
  if (existing) {
    return { ok: false, error: "An account with this email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email: normalizedEmail,
    passwordHash,
    isActive: true,
    emailVerifiedAt: null,
    authVersion: 0,
  });

  enqueue("welcome-email", {
    email: normalizedEmail,
    name,
    appUrl: absoluteUrl("/"),
  });
  await sendVerificationEmail(String(user._id));

  // Auto-join the invited workspace so the new user skips onboarding and the
  // explicit Accept step, landing straight in the workspace.
  if (inviteToken && inviteEmail) {
    const joined = await joinWorkspaceViaInvite({
      token: inviteToken,
      userId: String(user._id),
      userEmail: normalizedEmail,
      userName: name,
    });
    if (joined.ok) {
      return { ok: true, data: { workspaceSlug: joined.slug } };
    }
    return {
      ok: true,
      warning:
        "Your account is ready, but joining the workspace failed. You can create or join one from your dashboard.",
    };
  }

  return { ok: true };
}
