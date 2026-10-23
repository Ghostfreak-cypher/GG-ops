"use client";

import { useTransition } from "react";
import { Trash2, Crown } from "lucide-react";
import { removeTeamMemberAction } from "@/modules/people/server/actions/manage-team";
import { useRouter } from "next/navigation";

export function RemoveMemberButton({
  slug,
  teamId,
  userId,
}: {
  slug: string;
  teamId: string;
  userId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await removeTeamMemberAction(slug, teamId, userId);
          router.refresh();
        })
      }
      className="text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50 pointer-coarse:p-2.5"
      title="Remove from team"
    >
      <Trash2 className="size-4" />
    </button>
  );
}

export function LeadBadge() {
  return (
    <span className="flex items-center gap-1 font-mono text-[10px] uppercase text-amber-600">
      <Crown className="size-3" />
      Lead
    </span>
  );
}
