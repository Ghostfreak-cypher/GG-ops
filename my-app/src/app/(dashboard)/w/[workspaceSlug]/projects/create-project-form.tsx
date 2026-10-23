"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { createProjectAction } from "@/modules/project/server/actions/create-project";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CreateProjectForm({ slug }: { slug: string }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    // Redirects to the new project on success; a returned result means it failed.
    const res = await createProjectAction(slug, { name });
    if (res && !res.ok) {
      setError(res.error);
      setPending(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <form onSubmit={onSubmit} className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New project name"
          required
        />
        <Button type="submit" disabled={pending}>
          <Plus className="size-4" />
          {pending ? "Creating…" : "Create"}
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
