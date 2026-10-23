"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, RefreshCw, X, Copy, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { revokeInviteAction, resendInviteAction } from "@/modules/workspace/server/actions/manage-invite";
import type { PendingInviteDTO } from "@/modules/workspace/server/dto";

export function PendingInvites({
  invites,
  slug,
  canManage,
}: {
  invites: PendingInviteDTO[];
  slug: string;
  canManage: boolean;
}) {
  if (invites.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold text-sm uppercase tracking-widest text-muted-foreground">
          Pending invites
        </h2>
        <span className="border border-border px-1.5 py-0.5 font-mono text-[10px]">
          {invites.length}
        </span>
      </div>

      <div className="border border-border divide-y divide-border">
        {invites.map((invite) => (
          <InviteRow
            key={invite.id}
            invite={invite}
            slug={slug}
            canManage={canManage}
          />
        ))}
      </div>
    </div>
  );
}

function InviteRow({
  invite,
  slug,
  canManage,
}: {
  invite: PendingInviteDTO;
  slug: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(invite.inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleResend() {
    setResendMsg(null);
    startTransition(async () => {
      const res = await resendInviteAction(slug, { inviteId: invite.id });
      if (res.ok) {
        setResendMsg("Resent!");
        setTimeout(() => setResendMsg(null), 3000);
        router.refresh();
      }
    });
  }

  function handleRevoke() {
    if (!confirmRevoke) { setConfirmRevoke(true); return; }
    startTransition(async () => {
      await revokeInviteAction(slug, { inviteId: invite.id });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-4 px-4 py-3">
      {/* Icon + email */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center border border-dashed border-border">
          <Mail className="size-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{invite.email}</p>
          <p className="truncate text-xs text-muted-foreground">
            {invite.invitedByName ? `Invited by ${invite.invitedByName}` : "Invited"}
            {" · "}
            {new Date(invite.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Role badge */}
      <Badge variant="secondary" className="font-mono text-[10px] uppercase">
        {invite.role}
      </Badge>

      {/* Expiry */}
      <span
        className={cn(
          "font-mono text-[10px]",
          invite.daysLeft <= 2 ? "text-amber-600" : "text-muted-foreground",
        )}
      >
        Expires in {invite.daysLeft}d
      </span>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-2">
        {/* Copy link */}
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 pointer-coarse:min-h-11 font-mono text-[10px] uppercase text-muted-foreground transition-colors hover:text-foreground"
          title="Copy invite link"
        >
          {copied ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>

        {canManage && (
          <>
            {/* Resend */}
            <button
              onClick={handleResend}
              disabled={isPending}
              className="flex items-center gap-1 pointer-coarse:min-h-11 font-mono text-[10px] uppercase text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              title="Resend invite"
            >
              <RefreshCw className="size-3.5" />
              {resendMsg ?? "Resend"}
            </button>

            {/* Revoke */}
            {confirmRevoke ? (
              <>
                <button
                  onClick={handleRevoke}
                  disabled={isPending}
                  className="font-mono text-[10px] uppercase text-destructive hover:underline disabled:opacity-50"
                >
                  Revoke?
                </button>
                <button
                  onClick={() => setConfirmRevoke(false)}
                  className="font-mono text-[10px] uppercase text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmRevoke(true)}
                className="text-muted-foreground transition-colors hover:text-destructive"
                title="Revoke invite"
              >
                <X className="size-4" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
