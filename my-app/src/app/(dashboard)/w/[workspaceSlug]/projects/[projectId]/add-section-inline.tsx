"use client";

import * as React from "react";
import { useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createSectionAction } from "@/modules/section/server/actions/create-section";

interface AddSectionInlineProps {
  projectId: string;
  onCreated: () => void;
}

export function AddSectionInline({ projectId, onCreated }: AddSectionInlineProps) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    start(async () => {
      const res = await createSectionAction(projectId, { name: n });
      if (!res.ok) {
        toast.error(res.error ?? "Failed to add section");
        return;
      }
      setName("");
      setOpen(false);
      onCreated();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 flex items-center gap-2 px-1 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <Plus className="size-3.5" />
        Add section
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-2 flex max-w-xs items-center gap-2 px-1 py-1.5">
      <Plus className="size-3.5 shrink-0 text-muted-foreground" />
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Section name"
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setName("");
            setOpen(false);
          }
        }}
        onBlur={() => {
          if (!name.trim()) setOpen(false);
        }}
        disabled={pending}
      />
      <button
        type="submit"
        className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
        disabled={pending || !name.trim()}
      >
        Add
      </button>
      <button
        type="button"
        className="text-xs text-muted-foreground hover:text-foreground"
        onClick={() => {
          setName("");
          setOpen(false);
        }}
      >
        Cancel
      </button>
    </form>
  );
}
