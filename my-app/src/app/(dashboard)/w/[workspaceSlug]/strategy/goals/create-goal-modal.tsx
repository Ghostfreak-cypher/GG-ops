"use client";

import * as React from "react";
import { X } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { createGoalAction } from "@/modules/goal/server/actions/create-goal";
import { GOAL_STATUSES, GOAL_STATUS_UI } from "@/modules/goal/constants";
import type { GoalDTO } from "@/modules/goal/server/dto";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface CreateGoalModalProps {
  open: boolean;
  onClose: () => void;
  workspaceSlug: string;
  goals: GoalDTO[];
  defaultParentId?: string | null;
}

export function CreateGoalModal(props: CreateGoalModalProps) {
  return (
    <Sheet
      open={props.open}
      onOpenChange={(next) => {
        if (!next) props.onClose();
      }}
    >
      <SheetContent side="right" title="New goal">
        <CreateGoalPanel {...props} />
      </SheetContent>
    </Sheet>
  );
}

function CreateGoalPanel({ onClose, workspaceSlug, goals, defaultParentId = null }: CreateGoalModalProps) {
  const [title, setTitle] = React.useState("");
  const [status, setStatus] = React.useState<(typeof GOAL_STATUSES)[number]>("ON_TRACK");
  const [progress, setProgress] = React.useState(0);
  const [period, setPeriod] = React.useState("");
  const [teamLabel, setTeamLabel] = React.useState("");
  const [parentGoalId, setParentGoalId] = React.useState<string>(defaultParentId ?? "");
  const [pending, start] = useTransition();
  const titleRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => { titleRef.current?.focus(); }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    start(async () => {
      const res = await createGoalAction(workspaceSlug, {
        title: t,
        status,
        progress,
        period: period.trim() || undefined,
        teamLabel: teamLabel.trim() || undefined,
        parentGoalId: parentGoalId || undefined,
      });
      if (!res.ok) { toast.error(res.error ?? "Failed to create goal"); return; }
      toast.success("Goal created");
      onClose();
    });
  }

  const flatGoals = flattenGoals(goals);

  return (
    <>
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
          <span className="text-xs font-medium text-muted-foreground">New goal</span>
          <button type="button" onClick={onClose} aria-label="Close" className="flex size-7 pointer-coarse:size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            <textarea
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Goal title"
              rows={2}
              className="w-full resize-none bg-transparent text-xl font-semibold text-foreground outline-none placeholder:text-muted-foreground/40"
              onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
            />

            <div className="rounded-xl border border-border/60 bg-card/40 px-4 divide-y divide-border/60">
              {/* Status */}
              <div className="flex min-h-10 items-center gap-3 py-2.5">
                <span className="w-28 text-xs text-muted-foreground">Status</span>
                <div className="flex flex-wrap gap-1.5">
                  {GOAL_STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all",
                        status === s ? GOAL_STATUS_UI[s].badge : "bg-secondary text-secondary-foreground opacity-50 hover:opacity-100",
                      )}
                    >
                      <span className={cn("size-1.5 rounded-full", GOAL_STATUS_UI[s].dot)} />
                      {GOAL_STATUS_UI[s].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Progress */}
              <div className="flex min-h-10 items-center gap-3 py-2.5">
                <span className="w-28 shrink-0 text-xs text-muted-foreground">Progress</span>
                <div className="flex flex-1 items-center gap-3">
                  <input
                    type="range"
                    min={0} max={100} step={5}
                    value={progress}
                    onChange={(e) => setProgress(Number(e.target.value))}
                    className="flex-1 accent-primary"
                  />
                  <span className="w-8 text-right text-xs font-medium tabular-nums">{progress}%</span>
                </div>
              </div>

              {/* Period */}
              <div className="flex min-h-10 items-center gap-3 py-2.5">
                <span className="w-28 shrink-0 text-xs text-muted-foreground">Period</span>
                <input
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  placeholder="e.g. FY27, Q3 FY27"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                />
              </div>

              {/* Team */}
              <div className="flex min-h-10 items-center gap-3 py-2.5">
                <span className="w-28 shrink-0 text-xs text-muted-foreground">Team</span>
                <input
                  value={teamLabel}
                  onChange={(e) => setTeamLabel(e.target.value)}
                  placeholder="e.g. Sales, Operations"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                />
              </div>

              {/* Parent goal */}
              {flatGoals.length > 0 && (
                <div className="flex min-h-10 items-center gap-3 py-2.5">
                  <span className="w-28 shrink-0 text-xs text-muted-foreground">Parent goal</span>
                  <select
                    value={parentGoalId}
                    onChange={(e) => setParentGoalId(e.target.value)}
                    className="flex-1 cursor-pointer appearance-none bg-transparent text-sm outline-none"
                  >
                    <option value="">None (top-level)</option>
                    {flatGoals.map((g) => (
                      <option key={g.id} value={g.id}>{g.title}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 flex items-center justify-between border-t border-border bg-background px-5 py-3">
            {/* Keyboard hint is noise on touch, and at 320px it crowds the buttons. */}
            <p className="text-xs text-muted-foreground pointer-coarse:hidden">
              <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">Esc</kbd>{" "}to close
            </p>
            <div className="ml-auto flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
              <Button type="submit" size="sm" disabled={!title.trim() || pending}>
                {pending ? "Creating…" : "Create goal"}
              </Button>
            </div>
          </div>
        </form>
    </>
  );
}

function flattenGoals(goals: GoalDTO[]): GoalDTO[] {
  const result: GoalDTO[] = [];
  for (const g of goals) {
    result.push(g);
    result.push(...flattenGoals(g.children));
  }
  return result;
}
