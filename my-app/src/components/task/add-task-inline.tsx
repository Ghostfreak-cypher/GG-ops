"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { createTaskAction } from "@/modules/task/server/actions/create-task";

interface AddTaskInlineProps {
  projectId: string;
  sectionId: string | null;
  onCreated: () => void;
}

export function AddTaskInline({ projectId, sectionId, onCreated }: AddTaskInlineProps) {
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    start(async () => {
      const res = await createTaskAction(projectId, {
        title: t,
        ...(sectionId ? { sectionId } : {}),
      });
      if (!res.ok) {
        toast.error(res.error ?? "Failed to create task");
        return;
      }
      setTitle("");
      setOpen(false);
      onCreated();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Plus className="size-3.5" />
        Add task
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 px-3 py-1.5">
      <Plus className="size-3.5 shrink-0 text-muted-foreground" />
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task name"
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setTitle("");
            setOpen(false);
          }
        }}
        onBlur={() => {
          if (!title.trim()) setOpen(false);
        }}
        disabled={pending}
      />
      <button
        type="submit"
        className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
        disabled={pending || !title.trim()}
      >
        Add
      </button>
      <button
        type="button"
        className="text-xs text-muted-foreground hover:text-foreground"
        onClick={() => {
          setTitle("");
          setOpen(false);
        }}
      >
        Cancel
      </button>
    </form>
  );
}
