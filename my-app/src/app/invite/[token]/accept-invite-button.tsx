"use client";

import { useState } from "react";
import { acceptInviteAction } from "@/modules/workspace/server/actions/accept-invite";
import { Button } from "@/components/ui/button";

export function AcceptInviteButton({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <Button
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          // On success the action redirects; a returned result means it failed.
          const res = await acceptInviteAction(token);
          if (res && !res.ok) {
            setError(res.error);
            setPending(false);
          }
        }}
      >
        {pending ? "Joining…" : "Accept invite"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
