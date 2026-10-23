"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowLeft,
  Plus,
  Trash2,
  CalendarDays,
  Tag,
  User2,
  ListChecks,
  ChevronRight,
  ExternalLink,
  Pencil,
  AlertTriangle,
  Bell,
  BellOff,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { updateTaskAction } from "@/modules/task/server/actions/update-task";
import { archiveTaskAction } from "@/modules/task/server/actions/archive-task";
import { createTaskAction } from "@/modules/task/server/actions/create-task";
import { createLabelAction } from "@/modules/label/server/actions/create-label";
import { followTaskAction, unfollowTaskAction } from "@/modules/task/server/actions/follow-task";
import { TASK_TYPES } from "@/modules/task/constants";
import type { TaskDetailDTO } from "@/modules/task/server/dto";
import type { LabelDTO } from "@/modules/label/server/queries";
import { StatusPopover } from "@/components/task/status-popover";
import { PriorityPopover } from "@/components/task/priority-popover";
import { AssigneePopover } from "@/components/task/assignee-popover";
import { DueDatePopover } from "@/components/task/due-date-popover";
import { LabelPopover } from "@/components/task/label-popover";
import { AvatarStack } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { RichTextContent } from "@/components/ui/rich-text-content";
import { TaskDescriptionAttachments } from "@/components/task/task-description-attachments";
import { SaveStatus, type SaveState } from "@/components/ui/save-status";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { STATUS_UI, PRIORITY_UI, TYPE_UI } from "@/lib/task-ui";
import { cn } from "@/lib/utils";

/** `email` feeds @mention search in the comment box; optional so pass-through callers still compile. */
type Member = { id: string; name: string; email?: string | null; image?: string | null };

function SidebarField({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="flex w-28 shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="flex-1 text-sm">{children}</div>
    </div>
  );
}

function DateField({
  label,
  value,
  editable,
  pending,
  placeholder,
  onSelect,
  indicator,
}: {
  label: string;
  value: string | null;
  editable: boolean;
  pending: boolean;
  placeholder: string;
  onSelect: (date: string | null) => void;
  indicator?: React.ReactNode;
}) {
  return (
    <SidebarField label={label} icon={<CalendarDays className="size-3.5" />}>
      <DueDatePopover
        value={value}
        disabled={!editable || pending}
        onSelect={onSelect}
      >
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-left text-sm transition-colors hover:text-primary"
        >
          {value ? (
            <>
              {format(new Date(value), "MMM d, yyyy")}
              {indicator}
            </>
          ) : editable ? (
            <>
              <span className="text-muted-foreground">{placeholder}</span>
              <Pencil className="size-3.5 text-muted-foreground" />
            </>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </button>
      </DueDatePopover>
    </SidebarField>
  );
}

export function TaskDetail({
  slug,
  projectId,
  task,
  editable,
  members,
  labels,
  backHref,
  children,
  activity,
  isFollowing,
  followerCount,
}: {
  slug: string;
  projectId: string;
  task: TaskDetailDTO;
  editable: boolean;
  members: Member[];
  labels: LabelDTO[];
  backHref: string;
  children?: React.ReactNode;
  activity?: React.ReactNode;
  isFollowing?: boolean;
  followerCount?: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [followPending, startFollow] = useTransition();
  const [following, setFollowing] = useState(isFollowing ?? false);
  const [fCount, setFCount] = useState(followerCount ?? 0);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [newSubtask, setNewSubtask] = useState("");
  const [newLabel, setNewLabel] = useState("");

  function toggleFollow() {
    const next = !following;
    setFollowing(next);
    setFCount((c) => c + (next ? 1 : -1));
    startFollow(async () => {
      const res = next
        ? await followTaskAction(slug, task.id)
        : await unfollowTaskAction(slug, task.id);
      if (!res.ok) {
        setFollowing(!next);
        setFCount((c) => c + (next ? -1 : 1));
        toast.error(res.error ?? "Failed to update follow");
      }
    });
  }

  function save(patch: Record<string, unknown>) {
    start(async () => {
      const res = await updateTaskAction(task.id, patch);
      if (!res.ok) toast.error(res.error ?? "Failed to save");
      else router.refresh();
    });
  }

  // Debounced description autosave — no router.refresh() (that would remount the
  // editor and drop focus); we track the last saved value locally instead.
  const [descSave, setDescSave] = useState<SaveState>("idle");
  const lastSavedDesc = useRef(task.description ?? "");
  const descSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Plain async (not a transition) so background autosaves never disable the editor.
  async function persistDescription(html: string) {
    if (html === lastSavedDesc.current) return;
    setDescSave("saving");
    const res = await updateTaskAction(task.id, { description: html });
    if (!res.ok) {
      setDescSave("error");
      toast.error(res.error ?? "Failed to save");
      return;
    }
    lastSavedDesc.current = html;
    setDescSave("saved");
    if (descSavedTimer.current) clearTimeout(descSavedTimer.current);
    descSavedTimer.current = setTimeout(() => setDescSave("idle"), 2000);
  }

  const { debounced: debouncedSaveDescription, flush: flushDescription } = useDebouncedCallback(
    persistDescription,
    700,
  );

  const statusUi = STATUS_UI[task.status];
  const priorityUi = PRIORITY_UI[task.priority];
  const hasDateConflict = Boolean(
    task.startDate && task.dueDate && new Date(task.startDate).getTime() > new Date(task.dueDate).getTime(),
  );

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={backHref} className="flex items-center gap-1.5 transition-colors hover:text-foreground pointer-coarse:min-h-11">
          <ArrowLeft className="size-4" />
          Back to project
        </Link>
        <ChevronRight className="hidden size-3.5 sm:block" />
        <span className="hidden max-w-60 truncate font-medium text-foreground sm:inline">{task.title}</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            disabled={followPending}
            onClick={toggleFollow}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2.5 py-1 pointer-coarse:min-h-10 text-xs font-medium transition-colors disabled:opacity-50",
              following
                ? "border-primary bg-primary/10 text-primary hover:bg-primary/20"
                : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
            )}
          >
            {following ? (
              <>
                <BellOff className="size-3.5" />
                Following
              </>
            ) : (
              <>
                <Bell className="size-3.5" />
                Follow
              </>
            )}
            {fCount > 0 && (
              <span className="ml-0.5 rounded-full bg-muted px-1.5 py-px text-[10px] font-semibold">
                {fCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Grid from lg so the Details card can come right after the title on a phone
          (DOM order) while still sitting in the right-hand column on desktop. */}
      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[auto_1fr] lg:gap-x-10 lg:gap-y-6">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            {editable ? (
              <input
                className="-ml-1 w-full rounded bg-transparent px-1 text-2xl font-bold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={title}
                disabled={pending}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => {
                  const t = title.trim();
                  if (t && t !== task.title) save({ title: t });
                  else setTitle(task.title);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
              />
            ) : (
              <h1 className="text-2xl font-bold tracking-tight">{task.title}</h1>
            )}
        </div>

        <div className="w-full space-y-4 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <aside className="rounded-xl border border-border bg-card p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Details
            </p>

            <div className="divide-y divide-border">
              <SidebarField
                label="Status"
                icon={<span className={cn("size-2 rounded-full", statusUi.dot)} />}
              >
                <StatusPopover
                  value={task.status}
                  disabled={!editable || pending}
                  onSelect={(status) => save({ status })}
                >
                  <button
                    type="button"
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors hover:opacity-80",
                      statusUi.badge,
                    )}
                  >
                    {statusUi.label}
                  </button>
                </StatusPopover>
              </SidebarField>

              <SidebarField
                label="Priority"
                icon={<span className={cn("size-2 rounded-full", priorityUi.dot)} />}
              >
                <PriorityPopover
                  value={task.priority}
                  disabled={!editable || pending}
                  onSelect={(priority) => save({ priority })}
                >
                  <button
                    type="button"
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors hover:opacity-80",
                      priorityUi.badge,
                    )}
                  >
                    {priorityUi.label}
                  </button>
                </PriorityPopover>
              </SidebarField>

              <SidebarField label="Type" icon={<Tag className="size-3.5" />}>
                {editable ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground transition-colors hover:opacity-80"
                      >
                        {TYPE_UI[task.type].label}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuLabel>Task type</DropdownMenuLabel>
                      {TASK_TYPES.map((t) => (
                        <DropdownMenuItem key={t} onClick={() => save({ type: t })}>
                          {TYPE_UI[t].label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <span className="text-sm">{TYPE_UI[task.type].label}</span>
                )}
              </SidebarField>

              <DateField
                label="Due date"
                value={task.dueDate}
                editable={editable}
                pending={pending}
                placeholder="Set due date"
                onSelect={(dueDate) => save({ dueDate })}
                indicator={
                  task.recurrenceRule ? (
                    <RefreshCw className="size-3 text-muted-foreground" />
                  ) : undefined
                }
              />

              <DateField
                label="Start date"
                value={task.startDate}
                editable={editable}
                pending={pending}
                placeholder="Set start date"
                onSelect={(startDate) => save({ startDate })}
              />

              {hasDateConflict && (
                <div className="flex items-center gap-2 py-2 text-xs text-amber-700">
                  <AlertTriangle className="size-3.5" />
                  <span>Start is after due date</span>
                </div>
              )}

              <SidebarField label="Recurrence" icon={<RefreshCw className="size-3.5" />}>
                <div className="flex flex-col gap-1">
                  {editable ? (
                    <select
                      value={task.recurrenceRule ?? ""}
                      disabled={pending}
                      onChange={(e) =>
                        save({ recurrenceRule: e.target.value || null })
                      }
                      className="h-7 border-[3px] border-border bg-background px-2 text-xs font-medium text-foreground focus:outline-none"
                    >
                      <option value="">None</option>
                      <option value="DAILY">Daily</option>
                      <option value="WEEKLY">Weekly</option>
                      <option value="MONTHLY">Monthly</option>
                      <option value="YEARLY">Yearly</option>
                    </select>
                  ) : (
                    <span className="text-sm">
                      {task.recurrenceRule
                        ? task.recurrenceRule[0] +
                          task.recurrenceRule.slice(1).toLowerCase()
                        : "None"}
                    </span>
                  )}
                  {task.recurrenceParentId && (
                    <Link
                      href={`/w/${slug}/projects/${projectId}/tasks/${task.recurrenceParentId}`}
                      className="text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
                    >
                      ↻ Recurring — view parent task
                    </Link>
                  )}
                </div>
              </SidebarField>

              <SidebarField label="Assignees" icon={<User2 className="size-3.5" />}>
                <AssigneePopover
                  value={task.assignees.map((a) => a.id)}
                  members={members}
                  disabled={!editable || pending}
                  onSelect={(assigneeIds) => save({ assigneeIds })}
                >
                  <button type="button" className="flex flex-wrap items-center gap-1.5">
                    {task.assignees.length > 0 ? (
                      <>
                        <AvatarStack people={task.assignees} size="xs" />
                        <span className="text-xs text-muted-foreground">
                          {task.assignees.map((a) => a.name).join(", ")}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground hover:text-foreground">
                        Unassigned
                      </span>
                    )}
                  </button>
                </AssigneePopover>
              </SidebarField>

              <SidebarField label="Labels" icon={<Tag className="size-3.5" />}>
                <div className="space-y-1.5">
                  <div className="flex flex-wrap gap-1">
                    {task.labels.map((l) => (
                      <span
                        key={l.id}
                        className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-foreground"
                      >
                        <span
                          className="size-1.5 rounded-full"
                          style={{ backgroundColor: l.color ?? "var(--muted-foreground)" }}
                        />
                        {l.name}
                      </span>
                    ))}
                  </div>
                  <LabelPopover
                    value={task.labels.map((l) => l.id)}
                    labels={labels.map((l) => ({ id: l.id, name: l.name, color: l.color ?? null }))}
                    disabled={!editable || pending}
                    onSelect={(labelIds) => save({ labelIds })}
                  >
                    <button
                      type="button"
                      className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {task.labels.length === 0 ? "Add labels" : "Edit labels"}
                    </button>
                  </LabelPopover>

                  {editable && (
                    <div className="flex gap-1 pt-1">
                      <Input
                        className="h-7 text-xs"
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        placeholder="New label"
                      />
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled={pending || !newLabel.trim()}
                        onClick={() =>
                          start(async () => {
                            const res = await createLabelAction(slug, { name: newLabel });
                            if (!res.ok) {
                              toast.error(res.error ?? "Failed to create label");
                              return;
                            }
                            setNewLabel("");
                            router.refresh();
                          })
                        }
                      >
                        Add
                      </Button>
                    </div>
                  )}
                </div>
              </SidebarField>
            </div>

            <Separator className="my-4" />

            <div className="space-y-1 text-xs text-muted-foreground">
              {task.parentTaskId && (
                <p>
                  Subtask of{" "}
                  <Link
                    href={`/w/${slug}/projects/${projectId}/tasks/${task.parentTaskId}`}
                    className="font-medium text-foreground hover:text-primary"
                  >
                    parent task
                  </Link>
                </p>
              )}
            </div>
          </aside>

          {activity}
        </div>

        <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-2">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</p>
              <SaveStatus state={descSave} className="ml-auto" />
            </div>
            {editable ? (
              <RichTextEditor
                value={description}
                onChange={(html) => {
                  setDescription(html);
                  debouncedSaveDescription(html);
                }}
                onBlur={flushDescription}
                placeholder="Add a description..."
              />
            ) : (
              <div className="rounded-lg bg-muted/40 px-3 py-2.5">
                <RichTextContent
                  html={task.description}
                  emptyText="No description"
                />
              </div>
            )}

            <TaskDescriptionAttachments taskId={task.id} editable={editable} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ListChecks className="size-4 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Subtasks
              </p>
              <Badge variant="secondary" className="text-xs">
                {task.subtasks.length}
              </Badge>
            </div>

            <div className="overflow-hidden rounded-xl border border-border">
              {task.subtasks.length === 0 ? (
                <p className="px-4 py-3 text-xs text-muted-foreground">No subtasks yet</p>
              ) : (
                task.subtasks.map((s) => (
                  <Link
                    key={s.id}
                    className="group flex items-center gap-3 border-b border-border px-4 py-2.5 text-sm transition-colors last:border-b-0 hover:bg-muted"
                    href={`/w/${slug}/projects/${projectId}/tasks/${s.id}`}
                  >
                    <span
                      className={cn("size-2 rounded-full", STATUS_UI[s.status].dot)}
                    />
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate font-medium",
                        s.status === "DONE" && "text-muted-foreground line-through",
                      )}
                    >
                      {s.title}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-md px-1.5 py-0.5 text-xs",
                        STATUS_UI[s.status].badge,
                      )}
                    >
                      {STATUS_UI[s.status].label}
                    </span>
                    <ExternalLink className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                ))
              )}
            </div>

            {editable && (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newSubtask.trim()) return;
                  start(async () => {
                    const res = await createTaskAction(projectId, {
                      title: newSubtask,
                      parentTaskId: task.id,
                    });
                    if (!res.ok) {
                      toast.error(res.error ?? "Failed to create subtask");
                      return;
                    }
                    setNewSubtask("");
                    router.refresh();
                  });
                }}
              >
                <Input
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  placeholder="Add subtask..."
                  className="h-9"
                />
                <Button type="submit" variant="outline" size="sm" disabled={pending}>
                  <Plus className="size-4" />
                  Add
                </Button>
              </form>
            )}
          </div>

          {editable && (
            <div className="border-t border-border pt-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await archiveTaskAction(task.id);
                    if (!res.ok) {
                      toast.error(res.error ?? "Failed to archive");
                      return;
                    }
                    router.push(backHref);
                  })
                }
              >
                <Trash2 className="size-4" />
                Archive task
              </Button>
            </div>
          )}

          {children}
        </div>
      </div>
    </div>
  );
}


