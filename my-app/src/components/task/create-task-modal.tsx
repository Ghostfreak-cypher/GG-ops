"use client";

import * as React from "react";
import {
  X,
  CalendarDays,
  Tag,
  User2,
  AlignLeft,
  CheckCircle2,
  BarChart2,
  Layers,
} from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { createTaskAction } from "@/modules/task/server/actions/create-task";
import { TASK_TYPES } from "@/modules/task/constants";
import type { TaskStatus, TaskPriority, TaskType } from "@/modules/task/constants";
import type { BoardSection } from "@/modules/task/server/dto";
import { StatusPopover } from "@/components/task/status-popover";
import { PriorityPopover } from "@/components/task/priority-popover";
import { AssigneePopover } from "@/components/task/assignee-popover";
import { LabelPopover } from "@/components/task/label-popover";
import { DueDatePopover } from "@/components/task/due-date-popover";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Avatar } from "@/components/ui/avatar";
import { STATUS_UI, PRIORITY_UI, TYPE_UI } from "@/lib/task-ui";
import { cn } from "@/lib/utils";

type Member = { id: string; name: string; image?: string | null };
type LabelOpt = { id: string; name: string; color: string | null };

interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  projectId: string;
  sections: BoardSection[];
  members: Member[];
  labels: LabelOpt[];
  defaultSectionId?: string | null;
}

export function CreateTaskModal(props: CreateTaskModalProps) {
  // Sheet renders its content only while open, so CreateTaskPanel still mounts fresh
  // each time — and now gets a focus trap, focus restore and body-scroll lock too.
  return (
    <Sheet
      open={props.open}
      onOpenChange={(next) => {
        if (!next) props.onClose();
      }}
    >
      <SheetContent side="right" title="New task" className="max-w-[560px]">
        <CreateTaskPanel {...props} />
      </SheetContent>
    </Sheet>
  );
}

function FieldRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-10 flex-col gap-1 border-b border-border/60 py-2.5 last:border-b-0 md:flex-row md:items-start md:gap-3">
      <div className="flex shrink-0 items-center gap-2 pt-0.5 text-xs text-muted-foreground md:w-32">
        <span className="shrink-0">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="flex flex-1 flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function CreateTaskPanel({
  onClose,
  onCreated,
  projectId,
  sections,
  members,
  labels,
  defaultSectionId = null,
}: CreateTaskModalProps) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [status, setStatus] = React.useState<TaskStatus>("TODO");
  const [priority, setPriority] = React.useState<TaskPriority>("MEDIUM");
  const [type, setType] = React.useState<TaskType>("TASK");
  const [dueDate, setDueDate] = React.useState<string | null>(null);
  const [assigneeIds, setAssigneeIds] = React.useState<string[]>([]);
  const [labelIds, setLabelIds] = React.useState<string[]>([]);
  const [sectionId, setSectionId] = React.useState<string | null>(defaultSectionId);
  const [pending, start] = useTransition();
  const titleRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    titleRef.current?.focus();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    start(async () => {
      const res = await createTaskAction(projectId, {
        title: t,
        description: description.trim() || undefined,
        sectionId: sectionId || undefined,
        status,
        priority,
        type,
        dueDate: dueDate || undefined,
        assigneeIds,
        labelIds,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Failed to create task");
        return;
      }
      toast.success("Task created");
      onCreated();
      onClose();
    });
  }

  const statusUi = STATUS_UI[status];
  const priorityUi = PRIORITY_UI[priority];

  const selectedAssignees = members.filter((m) => assigneeIds.includes(m.id));
  const selectedLabels = labels.filter((l) => labelIds.includes(l.id));

  return (
    <>
      {/* Header bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">New task</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onClose}
              className="flex size-7 pointer-coarse:size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {/* Title — big editable heading */}
            <textarea
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Write a task name"
              rows={2}
              className="mb-4 w-full resize-none bg-transparent text-xl font-semibold text-foreground outline-none placeholder:text-muted-foreground/40"
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
            />

            {/* Field rows */}
            <div className="rounded-xl border border-border/60 bg-card/40 px-4">
              {/* Assignee */}
              <FieldRow icon={<User2 className="size-3.5" />} label="Assignee">
                <AssigneePopover value={assigneeIds} members={members} onSelect={setAssigneeIds}>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-md py-1 text-sm transition-colors hover:bg-muted"
                  >
                    {selectedAssignees.length > 0 ? (
                      <>
                        <div className="flex -space-x-1.5">
                          {selectedAssignees.slice(0, 3).map((m) => (
                            <Avatar
                              key={m.id}
                              name={m.name}
                              image={m.image}
                              size="xs"
                              className="ring-2 ring-background"
                            />
                          ))}
                        </div>
                        <span className="text-xs text-foreground">
                          {selectedAssignees.map((m) => m.name).join(", ")}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">No assignee</span>
                    )}
                  </button>
                </AssigneePopover>
              </FieldRow>

              {/* Due date */}
              <FieldRow icon={<CalendarDays className="size-3.5" />} label="Due date">
                <DueDatePopover value={dueDate} onSelect={setDueDate}>
                  <button
                    type="button"
                    className={cn(
                      "rounded-md py-1 text-sm transition-colors hover:bg-muted",
                      dueDate ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {dueDate ? format(new Date(dueDate), "MMM d, yyyy") : "No due date"}
                  </button>
                </DueDatePopover>
              </FieldRow>

              {/* Status */}
              <FieldRow
                icon={<span className={cn("size-2.5 rounded-full", statusUi.dot)} />}
                label="Status"
              >
                <StatusPopover value={status} onSelect={setStatus}>
                  <button
                    type="button"
                    className={cn(
                      "rounded-md px-2 py-1 text-xs font-medium transition-opacity hover:opacity-80",
                      statusUi.badge,
                    )}
                  >
                    {statusUi.label}
                  </button>
                </StatusPopover>
              </FieldRow>

              {/* Priority */}
              <FieldRow
                icon={<BarChart2 className="size-3.5" />}
                label="Priority"
              >
                <PriorityPopover value={priority} onSelect={setPriority}>
                  <button
                    type="button"
                    className={cn(
                      "rounded-md px-2 py-1 text-xs font-medium transition-opacity hover:opacity-80",
                      priorityUi.badge,
                    )}
                  >
                    {priorityUi.label}
                  </button>
                </PriorityPopover>
              </FieldRow>

              {/* Labels */}
              {labels.length > 0 && (
                <FieldRow icon={<Tag className="size-3.5" />} label="Labels">
                  <LabelPopover value={labelIds} labels={labels} onSelect={setLabelIds}>
                    <button
                      type="button"
                      className="flex flex-wrap items-center gap-1 py-1 hover:opacity-80"
                    >
                      {selectedLabels.length > 0 ? (
                        selectedLabels.map((l) => (
                          <span
                            key={l.id}
                            className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs"
                          >
                            <span
                              className="size-1.5 rounded-full"
                              style={{ backgroundColor: l.color ?? "var(--muted-foreground)" }}
                            />
                            {l.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">No labels</span>
                      )}
                    </button>
                  </LabelPopover>
                </FieldRow>
              )}

              {/* Section */}
              {sections.length > 0 && (
                <FieldRow icon={<Layers className="size-3.5" />} label="Section">
                  <select
                    value={sectionId ?? ""}
                    onChange={(e) => setSectionId(e.target.value || null)}
                    className="cursor-pointer appearance-none rounded-md bg-transparent py-1 text-sm text-foreground outline-none hover:bg-muted"
                  >
                    <option value="">No section</option>
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </FieldRow>
              )}

              {/* Type */}
              <FieldRow icon={<CheckCircle2 className="size-3.5" />} label="Task type">
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as TaskType)}
                  className="cursor-pointer appearance-none rounded-md bg-transparent py-1 text-sm text-foreground outline-none hover:bg-muted"
                >
                  {TASK_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {TYPE_UI[t].label}
                    </option>
                  ))}
                </select>
              </FieldRow>
            </div>

            {/* Description */}
            <div className="mt-4">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <AlignLeft className="size-3.5" />
                Description
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this task about?"
                rows={4}
                className="w-full resize-none rounded-xl border border-border/60 bg-card/40 p-3 text-base md:text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-border focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 flex items-center justify-between border-t border-border bg-background px-5 py-3">
            {/* Keyboard hint is noise on touch, and at 320px it crowds the buttons. */}
            <p className="text-xs text-muted-foreground pointer-coarse:hidden">
              <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
                Esc
              </kbd>{" "}
              to close
            </p>
            <div className="ml-auto flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!title.trim() || pending}>
                {pending ? "Creating…" : "Create task"}
              </Button>
            </div>
          </div>
        </form>
    </>
  );
}
