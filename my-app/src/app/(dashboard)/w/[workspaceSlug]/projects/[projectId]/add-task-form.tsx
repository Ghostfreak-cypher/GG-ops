"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createTaskAction } from "@/modules/task/server/actions/create-task";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AddTaskForm({
  projectId,
  sectionId,
}: {
  projectId: string;
  sectionId: string | null;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    start(async () => {
      const res = await createTaskAction(projectId, {
        title,
        ...(sectionId ? { sectionId } : {}),
      });
      if (!res.ok) {
        alert(res.error);
        return;
      }
      setTitle("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-sm gap-2">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add task"
        className="h-9"
      />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        <Plus className="size-4" />
        Add
      </Button>
    </form>
  );
}
