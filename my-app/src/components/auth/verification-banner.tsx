"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { sendVerificationEmailAction } from "@/modules/auth/server/actions/verify-email";

export function VerificationBanner({ userId }: { userId: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function resend() {
    setPending(true);
    setMessage(null);
    const result = await sendVerificationEmailAction({ userId });
    setPending(false);
    setMessage(result.ok ? "Verification email sent." : result.error);
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 md:px-6 text-sm text-amber-900">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
        <span className="flex-1">Verify your email to keep your account secure.</span>
        <Button size="sm" variant="outline" onClick={resend} disabled={pending}>
          {pending ? "Sending..." : "Resend verification"}
        </Button>
        {message ? <span className="text-xs text-amber-800">{message}</span> : null}
      </div>
    </div>
  );
}
