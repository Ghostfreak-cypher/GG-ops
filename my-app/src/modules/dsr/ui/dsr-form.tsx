"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Plus, X } from "lucide-react";
import { upsertDsrAction } from "@/modules/dsr/server/actions/upsert-dsr";
import { formatDuration, splitDuration } from "@/modules/dsr/format";
import { DsrTaskPicker, type LinkableTask } from "@/modules/dsr/ui/dsr-task-picker";
import type { DsrDTO } from "@/modules/dsr/server/dto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Textarea styling. There's no `Textarea` primitive in `components/ui`, and with only one
 * DSR form left this lives here rather than in a file of its own.
 */
const textareaClass =
  "flex w-full resize-y rounded-md border border-input bg-background px-4 py-2.5 font-sans text-base md:text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30";

/**
 * One editable line of the work log. `key` is a counter rather than the array index —
 * removing a middle row shifts every index below it, and React would then reuse the wrong
 * input, moving the text the user typed onto a different row.
 */
type Row = {
  key: number;
  task: string;
  hours: string;
  minutes: string;
  /** Optional link to the task this row was work on. */
  taskId: string | null;
  /** Only for showing the chip — null when the linked task is archived or gone. */
  taskTitle: string | null;
};

let nextRowKey = 0;
function blankRow(): Row {
  return { key: nextRowKey++, task: "", hours: "", minutes: "", taskId: null, taskTitle: null };
}

function seedRows(existing: DsrDTO | null): Row[] {
  if (!existing || existing.entries.length === 0) return [blankRow()];
  return existing.entries.map((entry) => {
    const { hours, minutes } = splitDuration(entry.minutes);
    return {
      key: nextRowKey++,
      task: entry.task,
      hours: String(hours),
      minutes: String(minutes),
      // Carried through even when `linkedTask` is null, so re-filing a day doesn't quietly
      // drop a link just because that task has since been archived.
      taskId: entry.taskId,
      taskTitle: entry.linkedTask?.title ?? null,
    };
  });
}

function rowMinutes(row: Row): number {
  return (Number(row.hours) || 0) * 60 + (Number(row.minutes) || 0);
}

/**
 * A row the user added but never filled in shouldn't fail validation on their behalf.
 * A link alone doesn't count as filled in — there's still nothing to report.
 */
function isBlank(row: Row): boolean {
  return row.task.trim() === "" && rowMinutes(row) === 0;
}

/**
 * Files the report for `date`. `existing` is that day's report if one is already on record,
 * in which case the form opens as an edit rather than a blank slate.
 *
 * Changing the date navigates instead of just updating state, so the server can hand back
 * the right `existing`. The parent remounts this with `key={date}` to reseed the fields.
 */
export function DsrForm({
  slug,
  basePath,
  date,
  maxDate,
  existing,
  linkableTasks,
}: {
  slug: string;
  basePath: string;
  date: string;
  /** Today — you can't report on work you haven't done yet. */
  maxDate: string;
  existing: DsrDTO | null;
  /** Your own unfinished tasks, offered by each row's task picker. */
  linkableTasks: LinkableTask[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<Row[]>(() => seedRows(existing));
  const [tomorrowPlan, setTomorrowPlan] = useState(existing?.tomorrowPlan ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // React Compiler is enabled, so this is memoized for us — no useMemo.
  const totalMinutes = rows.reduce((sum, row) => sum + rowMinutes(row), 0);

  function onDateChange(nextDate: string) {
    if (!nextDate) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", nextDate);
    router.push(`${basePath}?${params.toString()}`);
  }

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await upsertDsrAction(slug, {
      date,
      entries: rows
        .filter((row) => !isBlank(row))
        .map((row) => ({ task: row.task, minutes: rowMinutes(row), taskId: row.taskId })),
      tomorrowPlan,
    });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {existing ? "Update this day's report" : "File your daily status report"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="max-w-[12rem] space-y-1.5">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              max={maxDate}
              onChange={(e) => onDateChange(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>What did you do today?</Label>

            <div className="hidden gap-2 px-1 font-mono text-[10px] uppercase text-muted-foreground sm:grid sm:grid-cols-[1fr_5rem_5rem_2rem]">
              <span>Task</span>
              <span>Hours</span>
              <span>Minutes</span>
              <span />
            </div>

            <div className="space-y-2">
              {rows.map((row, index) => (
                <div
                  key={row.key}
                  className="grid grid-cols-[1fr_2rem] gap-2 sm:grid-cols-[1fr_5rem_5rem_2rem]"
                >
                  <div className="col-span-2 space-y-1 sm:col-span-1">
                    <Input
                      aria-label={`Task ${index + 1}`}
                      placeholder="What you worked on"
                      value={row.task}
                      maxLength={500}
                      onChange={(e) => updateRow(row.key, { task: e.target.value })}
                    />
                    {/* Under the text rather than in its own column: a fifth column would
                        leave nothing usable at 375px. */}
                    <DsrTaskPicker
                      tasks={linkableTasks}
                      taskId={row.taskId}
                      taskTitle={row.taskTitle}
                      onPick={(task) =>
                        updateRow(row.key, { taskId: task.id, taskTitle: task.title })
                      }
                      onClear={() => updateRow(row.key, { taskId: null, taskTitle: null })}
                    />
                  </div>
                  <Input
                    aria-label={`Hours for task ${index + 1}`}
                    type="number"
                    min={0}
                    max={24}
                    placeholder="0"
                    value={row.hours}
                    onChange={(e) => updateRow(row.key, { hours: e.target.value })}
                    className="tabular-nums"
                  />
                  <Input
                    aria-label={`Minutes for task ${index + 1}`}
                    type="number"
                    min={0}
                    max={59}
                    step={5}
                    placeholder="0"
                    value={row.minutes}
                    onChange={(e) => updateRow(row.key, { minutes: e.target.value })}
                    className="tabular-nums"
                  />
                  {/* The last remaining row has no remove button — a report with no rows
                      can't be filed, so there'd be nothing to click back into. */}
                  {rows.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                      aria-label={`Remove task ${index + 1}`}
                      className="flex size-9 items-center justify-center self-end text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <X className="size-4" />
                    </button>
                  ) : (
                    <span className="hidden sm:block" />
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => setRows((prev) => [...prev, blankRow()])}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:underline underline-offset-2"
              >
                <Plus className="size-4" />
                Add row
              </button>
              <span className="font-display text-sm font-semibold tabular-nums">
                Total: {formatDuration(totalMinutes)}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tomorrowPlan">What will you do tomorrow?</Label>
            <textarea
              id="tomorrowPlan"
              value={tomorrowPlan}
              onChange={(e) => setTomorrowPlan(e.target.value)}
              rows={3}
              maxLength={4000}
              required
              className={textareaClass}
            />
          </div>

          <Button type="submit" disabled={pending}>
            <Check className="size-4" />
            {pending ? "Saving…" : existing ? "Update report" : "Submit report"}
          </Button>
        </form>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
