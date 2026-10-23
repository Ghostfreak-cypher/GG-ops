"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { CalendarDays, User2, Quote } from "lucide-react";
import { approveDraftAction, rejectDraftAction } from "@/modules/task-draft/server/actions/review-draft";
import { AssigneePopover, type AssigneeMember } from "@/components/task/assignee-popover";
import { DueDatePopover } from "@/components/task/due-date-popover";
import { PriorityPopover } from "@/components/task/priority-popover";
import { ProjectSelect } from "@/components/task/project-select";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PRIORITY_UI } from "@/lib/task-ui";
import { cn } from "@/lib/utils";
import type { DraftDTO } from "@/modules/task-draft/server/queries";
import type { ProjectSummary } from "@/modules/project/server/queries";
import type { TaskPriority } from "@/modules/task/constants";

export function DraftList({
  drafts,
  slug,
  members,
  projects,
  canReview,
}: {
  drafts: DraftDTO[];
  slug: string;
  members: AssigneeMember[];
  projects: ProjectSummary[];
  canReview: boolean;
}) {
  if (drafts.length === 0) {
    return (
      <p className="border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        No drafts waiting for review.
      </p>
    );
  }

  return (
    <div className="border border-border divide-y divide-border">
      {drafts.map((draft) => (
        <DraftRow
          key={draft.id}
          draft={draft}
          slug={slug}
          members={members}
          projects={projects}
          canReview={canReview}
        />
      ))}
    </div>
  );
}

function DraftRow({
  draft,
  slug,
  members,
  projects,
  canReview,
}: {
  draft: DraftDTO;
  slug: string;
  members: AssigneeMember[];
  projects: ProjectSummary[];
  canReview: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmReject, setConfirmReject] = useState(false);

  const [title, setTitle] = useState(draft.title);
  const [description, setDescription] = useState(draft.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>(draft.priority);
  const [dueDate, setDueDate] = useState<string | null>(draft.dueDate);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(draft.assigneeIds);
  const [projectId, setProjectId] = useState<string | null>(draft.projectId);

  const disabled = isPending || !canReview;
  const priorityUi = PRIORITY_UI[priority];
  const selectedAssignees = members.filter((m) => assigneeIds.includes(m.id));

  function handleApprove() {
    if (!projectId) {
      toast.error("Choose a project before approving");
      return;
    }
    startTransition(async () => {
      const res = await approveDraftAction(slug, draft.id, {
        projectId,
        title,
        description: description.trim() || undefined,
        priority,
        dueDate,
        assigneeIds,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Failed to approve draft");
        return;
      }
      toast.success("Task created");
      router.refresh();
    });
  }

  function handleReject() {
    if (!confirmReject) {
      setConfirmReject(true);
      return;
    }
    startTransition(async () => {
      const res = await rejectDraftAction(slug, draft.id);
      if (!res.ok) {
        toast.error(res.error ?? "Failed to reject draft");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 px-4 py-4">
      {/* Provenance — why this draft exists, so review is a judgment call, not a rubber stamp */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {draft.sourceMeetingTitle && (
          <span className="font-medium text-foreground">{draft.sourceMeetingTitle}</span>
        )}
        {draft.sourceMeetingDate && <span>{draft.sourceMeetingDate}</span>}
        {draft.confidence !== null && (
          <span className="border border-border px-1.5 py-0.5 font-mono text-[10px]">
            {Math.round(draft.confidence * 100)}% confidence
          </span>
        )}
      </div>
      {draft.sourceExcerpt && (
        <blockquote className="flex gap-2 border-l-2 border-border pl-3 text-sm italic text-muted-foreground">
          <Quote className="mt-0.5 size-3.5 shrink-0" />
          <span>{draft.sourceExcerpt}</span>
        </blockquote>
      )}

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={disabled}
        placeholder="Task title"
        className="w-full bg-transparent text-base font-medium text-foreground outline-none disabled:opacity-70"
      />

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        disabled={disabled}
        rows={2}
        placeholder="Description"
        className="w-full resize-none bg-transparent text-sm text-muted-foreground outline-none disabled:opacity-70"
      />

      <div className="flex flex-wrap items-center gap-2">
        <ProjectSelect value={projectId} projects={projects} disabled={disabled} onChange={setProjectId} />

        <AssigneePopover value={assigneeIds} members={members} disabled={disabled} onSelect={setAssigneeIds}>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs disabled:opacity-70"
          >
            {selectedAssignees.length > 0 ? (
              <div className="flex -space-x-1.5">
                {selectedAssignees.slice(0, 3).map((m) => (
                  <Avatar key={m.id} name={m.name} image={m.image} size="xs" className="ring-2 ring-background" />
                ))}
              </div>
            ) : (
              <User2 className="size-3.5" />
            )}
            {selectedAssignees.length > 0 ? selectedAssignees.map((m) => m.name).join(", ") : "Assignee"}
          </button>
        </AssigneePopover>

        <DueDatePopover value={dueDate} disabled={disabled} onSelect={setDueDate}>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs disabled:opacity-70"
          >
            <CalendarDays className="size-3.5" />
            {dueDate ? format(new Date(dueDate), "MMM d") : "Due date"}
          </button>
        </DueDatePopover>

        <PriorityPopover value={priority} disabled={disabled} onSelect={setPriority}>
          <button
            type="button"
            className={cn("rounded-md px-2 py-1 text-xs font-medium disabled:opacity-70", priorityUi.badge)}
          >
            {priorityUi.label}
          </button>
        </PriorityPopover>
      </div>

      {canReview && (
        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" onClick={handleApprove} disabled={isPending}>
            {isPending ? "Working…" : "Approve"}
          </Button>
          {confirmReject ? (
            <>
              <button
                onClick={handleReject}
                disabled={isPending}
                className="font-mono text-[10px] uppercase text-destructive hover:underline disabled:opacity-50"
              >
                Reject?
              </button>
              <button
                onClick={() => setConfirmReject(false)}
                className="font-mono text-[10px] uppercase text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={handleReject} disabled={isPending}>
              Reject
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
