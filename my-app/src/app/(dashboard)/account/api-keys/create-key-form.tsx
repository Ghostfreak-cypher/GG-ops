"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { createApiKeyAction } from "@/modules/api-key/server/actions/create-api-key";
import type { ApiKeyScope } from "@/models/ApiKey";

export function CreateKeyForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [canWrite, setCanWrite] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mintedToken, setMintedToken] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const scopes: ApiKeyScope[] = canWrite ? ["read", "write"] : ["read"];
    const result = await createApiKeyAction({ name, scopes });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMintedToken(result.data!.token);
    setName("");
    setCanWrite(false);
    router.refresh();
  }

  if (mintedToken) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-destructive">
          Copy this key now — you won&apos;t be able to see it again.
        </p>
        <code className="block break-all rounded border border-border bg-muted p-3 text-xs">
          {mintedToken}
        </code>
        <Button
          variant="outline"
          onClick={() => {
            navigator.clipboard.writeText(mintedToken);
          }}
        >
          Copy
        </Button>
        <Button variant="ghost" onClick={() => setMintedToken(null)}>
          Done
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="keyName">Name</Label>
        <Input
          id="keyName"
          placeholder="e.g. Claude Code"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="canWrite" checked={canWrite} onCheckedChange={(v) => setCanWrite(v === true)} />
        <Label htmlFor="canWrite" className="font-normal">
          Allow this key to create and edit tasks (write). Unchecked keys can only read.
        </Label>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating..." : "Create key"}
      </Button>
    </form>
  );
}
