"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { revokeApiKeyAction } from "@/modules/api-key/server/actions/revoke-api-key";

export function RevokeKeyButton({ keyId }: { keyId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onRevoke() {
    if (!confirm("Revoke this key? Anything using it will stop working immediately.")) return;
    setPending(true);
    const result = await revokeApiKeyAction(keyId);
    setPending(false);
    if (result.ok) router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={onRevoke} disabled={pending}>
      {pending ? "Revoking..." : "Revoke"}
    </Button>
  );
}
