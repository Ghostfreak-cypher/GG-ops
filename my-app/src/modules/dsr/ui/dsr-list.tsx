"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { format, parse } from "date-fns";
import { Link2, Pencil, Trash2 } from "lucide-react";
import { deleteDsrAction } from "@/modules/dsr/server/actions/delete-dsr";
import { formatDuration } from "@/modules/dsr/format";
import { DSR_PAGE_SIZE } from "@/modules/dsr/constants";
import type { DsrDTO } from "@/modules/dsr/server/dto";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

function formatDay(date: string): string {
  return format(parse(date, "yyyy-MM-dd", new Date()), "EEEE, d MMMM yyyy");
}

/**
 * A page of reports, newest first. `readOnly` is what the team views pass: with no `slug` to
 * act against and no buttons rendered, the read surface carries no way to write.
 */
export function DsrList({
  dsrs,
  slug,
  workspaceSlug,
  basePath,
  emptyMessage,
  readOnly = false,
  hasMore = false,
}: {
  dsrs: DsrDTO[];
  /** Required to edit or delete; omitted on the read-only team views. */
  slug?: string;
  /**
   * Only ever used to build hrefs to linked tasks — deliberately separate from `slug`,
   * which carries "this surface may write". The team views pass this and not `slug`, so a
   * reader can click through to a task without the read surface gaining a way to mutate.
   */
  workspaceSlug?: string;
  basePath?: string;
  emptyMessage: string;
  readOnly?: boolean;
  /** More reports exist in this window than are rendered here. */
  hasMore?: boolean;
}) {
  if (dsrs.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 p-6 text-center sm:p-10">
        <p className="text-sm italic text-muted-foreground">{emptyMessage}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {dsrs.map((dsr) => (
        <DsrCard
          key={dsr.id}
          dsr={dsr}
          slug={slug}
          workspaceSlug={workspaceSlug}
          basePath={basePath}
          readOnly={readOnly}
        />
      ))}
      {hasMore && <LoadMore />}
    </div>
  );
}

/**
 * Reveals the next page when it scrolls into view.
 *
 * Deliberately a real button rather than a bare sentinel div: keyboard users, and anyone
 * whose browser never fires the observer, still reach every report.
 *
 * The page size lives in `?take=`, so the server stays the only thing that reads reports —
 * no second endpoint, and no client-held list to resync after an edit or a delete.
 * ponytail: re-reads `take + 1` rows per page rather than only the next 7. A window is one
 * month (<= 31 rows), so it's bounded; a `$lt` cursor on `date` is the fix if that changes.
 */
function LoadMore() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLButtonElement>(null);

  function loadMore() {
    const params = new URLSearchParams(searchParams.toString());
    const take = Number(params.get("take")) || DSR_PAGE_SIZE;
    params.set("take", String(take + DSR_PAGE_SIZE));
    // `replace`, so paging doesn't fill the back button; `scroll: false`, so the reader
    // stays where they were reading.
    startTransition(() => router.replace(`?${params.toString()}`, { scroll: false }));
  }

  useEffect(() => {
    const el = ref.current;
    // No observer at all while a page is in flight — that, rather than a guard inside the
    // callback, is what stops a sentinel still on screen from firing twice.
    if (!el || pending) return;

    const observer = new IntersectionObserver(
      // Scrolling the button into view simply presses it, so the scroll path and the click
      // path are the same code and can't drift apart.
      (entries) => {
        if (entries[0]?.isIntersecting) el.click();
      },
      { rootMargin: "300px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [pending]);

  return (
    <button
      ref={ref}
      type="button"
      onClick={loadMore}
      disabled={pending}
      className="flex w-full items-center justify-center rounded-md border border-border py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
    >
      {pending ? "Loading…" : `Show ${DSR_PAGE_SIZE} more`}
    </button>
  );
}

function DsrCard({
  dsr,
  slug,
  workspaceSlug,
  basePath,
  readOnly,
}: {
  dsr: DsrDTO;
  slug?: string;
  /** Link-building only — see the note on `DsrList`. */
  workspaceSlug?: string;
  basePath?: string;
  readOnly: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const editable = !readOnly && !!slug && !!basePath;

  // Editing is just loading the day back into the form at the top of the page — the same
  // upsert then amends it, so there's no second write path to keep in sync.
  function onEdit() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", dsr.date);
    router.push(`${basePath}?${params.toString()}`);
  }

  async function onDelete() {
    if (!slug) return;
    setPending(true);
    setError(null);
    const res = await deleteDsrAction(slug, { dsrId: dsr.id });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      setConfirming(false);
      return;
    }
    router.refresh();
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-sm font-semibold">{formatDay(dsr.date)}</h3>
          {/* Deliberately no clock time: this list is server-rendered before it hydrates,
              and a locale-formatted timestamp renders in the server's timezone first and
              the viewer's second. Whether the day was amended is the only signal needed. */}
          {dsr.createdAt === dsr.updatedAt ? null : (
            <p className="text-xs text-muted-foreground">Edited after filing</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline" className="tabular-nums">
            {formatDuration(dsr.totalMinutes)}
          </Badge>
          {editable ? (
            <>
              <button
                type="button"
                onClick={onEdit}
                aria-label={`Edit report for ${dsr.date}`}
                className="p-1.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <Pencil className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => (confirming ? onDelete() : setConfirming(true))}
                disabled={pending}
                aria-label={`Delete report for ${dsr.date}`}
                className="p-1.5 text-muted-foreground transition-colors hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </>
          ) : null}
        </div>
      </div>

      {confirming && editable ? (
        <p className="mt-2 text-xs text-destructive">
          Click delete again to remove this report.{" "}
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="underline underline-offset-2"
          >
            Cancel
          </button>
        </p>
      ) : null}

      <div className="mt-3 space-y-3 border-t border-border pt-3">
        <div>
          <p className="font-mono text-[10px] uppercase text-muted-foreground">What was done</p>
          <ul className="mt-1 divide-y divide-border">
            {dsr.entries.map((entry, i) => (
              <li key={i} className="flex items-baseline justify-between gap-4 py-1.5">
                <span className="min-w-0 text-sm text-foreground">
                  {entry.task}
                  {/* Only rendered once the task still resolves — a link needs its
                      projectId, and an archived or deleted task has neither. The entry
                      then reads exactly as it did before links existed. */}
                  {entry.linkedTask && workspaceSlug ? (
                    <Link
                      href={`/w/${workspaceSlug}/projects/${entry.linkedTask.projectId}/tasks/${entry.taskId}`}
                      className="ml-2 inline-flex max-w-full items-center gap-1 align-middle text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <Link2 className="size-3 shrink-0" />
                      <span className="truncate">{entry.linkedTask.title}</span>
                    </Link>
                  ) : null}
                </span>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  {formatDuration(entry.minutes)}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <dl>
          <Field label="Plan for tomorrow">{dsr.tomorrowPlan}</Field>
        </dl>
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">{children}</dd>
    </div>
  );
}
