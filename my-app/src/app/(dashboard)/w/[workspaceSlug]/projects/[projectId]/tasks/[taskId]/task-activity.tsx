"use client";

import { useState } from "react";
import { Activity } from "lucide-react";
import type { ActivityDTO } from "@/modules/activity/server/queries";

/** How many of the latest entries to show before the "Show more" toggle. */
const INITIAL_VISIBLE = 12;

function fmt(iso: string) {
  return iso ? iso.slice(0, 16).replace("T", " ") : "";
}

export function TaskActivity({ activity }: { activity: ActivityDTO[] }) {
  const [expanded, setExpanded] = useState(false);

  // `activity` is already sorted newest-first by the query.
  const shown = expanded ? activity : activity.slice(0, INITIAL_VISIBLE);
  const hiddenCount = activity.length - INITIAL_VISIBLE;

  return (
    <aside className="w-full rounded-xl border border-border bg-card p-4">
      <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Activity className="size-4" />
        Activity
      </h2>

      {activity.length === 0 ? (
        <p className="text-xs text-muted-foreground">No activity yet.</p>
      ) : (
        <>
          <ul className="space-y-3 border-l border-border pl-4 text-xs text-muted-foreground">
            {shown.map((a) => (
              <li key={a.id} className="relative">
                <span className="absolute -left-[1.3rem] top-1 size-2 rounded-full border-2 border-card bg-muted-foreground" />
                <span className="font-medium text-foreground">{a.actor}</span>{" "}
                {a.action.toLowerCase().replace(/_/g, " ")} · {fmt(a.createdAt)}
              </li>
            ))}
          </ul>

          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-3 text-xs font-medium text-primary transition-colors hover:underline"
            >
              {expanded ? "Show less" : `Show ${hiddenCount} more`}
            </button>
          )}
        </>
      )}
    </aside>
  );
}
