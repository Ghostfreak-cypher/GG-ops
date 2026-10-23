import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/server/session";
import { connectDB } from "@/lib/db";
import { WorkspaceInvite } from "@/models/WorkspaceInvite";
import { Workspace } from "@/models/Workspace";
import { User } from "@/models/User";
import { isInviteExpired } from "@/modules/workspace/invites";
import { AcceptInviteButton } from "./accept-invite-button";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const user = await getCurrentUser();

  await connectDB();
  const invite = await WorkspaceInvite.findOne({ token }).lean();
  const workspace = invite ? await Workspace.findById(invite.workspaceId).lean() : null;
  const invalid =
    !invite || !!invite.acceptedAt || isInviteExpired(invite.expiresAt) || !workspace;

  // Route unauthenticated visitors by whether the invited email already has an
  // account: existing users sign in and then Accept; brand-new users sign up
  // (email pre-filled) and are auto-joined during sign-up.
  if (!user && !invalid) {
    const hasAccount = await User.exists({ email: invite!.email });
    if (hasAccount) {
      redirect(`/sign-in?next=${encodeURIComponent(`/invite/${token}`)}`);
    }
    redirect(
      `/sign-up?next=/&inviteToken=${encodeURIComponent(token)}&email=${encodeURIComponent(invite!.email)}`,
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-6 text-center">
      {invalid ? (
        <>
          <h1 className="text-2xl font-semibold">Invite unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This invite is invalid, expired, or already used.
          </p>
          <Link className="mt-4 underline" href="/">
            Go home
          </Link>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-semibold">Join {workspace!.name}</h1>
          <p className="mb-6 mt-2 text-sm text-muted-foreground">
            You&apos;ve been invited as {invite!.role}.
          </p>
          <AcceptInviteButton token={token} />
        </>
      )}
    </div>
  );
}
