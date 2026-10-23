"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  WORKSPACE_EMAIL_EVENT_LABELS,
  type WorkspaceEmailEvent,
  type WorkspaceEmailFrequency,
} from "@/lib/notification-preferences-types";
import { saveNotificationPreferencesAction } from "@/modules/workspace/server/actions/save-notification-preferences";

export function WorkspaceEmailPreferencesForm({
  slug,
  initial,
}: {
  slug: string;
  initial: Record<WorkspaceEmailEvent, WorkspaceEmailFrequency>;
}) {
  const [prefs, setPrefs] = useState(initial);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const eventGroups = useMemo(
    () => ({
      immediate: [
        "INVITE",
        "WORKSPACE_JOINED",
        "ROLE_UPDATED",
        "TASK_ASSIGNED",
        "TASK_DUE",
        "TASK_DUE_TOMORROW",
        "TASK_OVERDUE",
        "TASK_COMPLETED",
        "TASK_COMMENTED",
        "COMMENT_MENTION",
        "MEMBER_JOINED",
      ] as WorkspaceEmailEvent[],
      digest: ["DIGEST_DAILY", "DIGEST_WEEKLY"] as WorkspaceEmailEvent[],
    }),
    [],
  );

  async function save() {
    setPending(true);
    setMessage(null);
    const result = await saveNotificationPreferencesAction(slug, { updates: prefs });
    setPending(false);
    setMessage(result.ok ? "Preferences saved." : result.error);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Activity emails</h2>
        <div className="space-y-3">
          {eventGroups.immediate.map((event) => (
            <div key={event} className="flex items-center justify-between gap-4 border-b border-border pb-3 last:border-b-0 last:pb-0">
              <div>
                <div className="text-sm font-medium">{WORKSPACE_EMAIL_EVENT_LABELS[event]}</div>
                <div className="text-xs text-muted-foreground">Immediate email or off.</div>
              </div>
              <Select
                value={prefs[event]}
                onChange={(e) => setPrefs((current) => ({ ...current, [event]: e.target.value as WorkspaceEmailFrequency }))}
                wrapperClassName="w-36 shrink-0"
              >
                <option value="IMMEDIATE">Immediate</option>
                <option value="OFF">Off</option>
              </Select>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Digest emails</h2>
        <div className="space-y-3">
          {eventGroups.digest.map((event) => (
            <div key={event} className="flex items-center justify-between gap-4 border-b border-border pb-3 last:border-b-0 last:pb-0">
              <div>
                <div className="text-sm font-medium">{WORKSPACE_EMAIL_EVENT_LABELS[event]}</div>
                <div className="text-xs text-muted-foreground">Scheduled summary emails.</div>
              </div>
              <Select
                value={prefs[event]}
                onChange={(e) => setPrefs((current) => ({ ...current, [event]: e.target.value as WorkspaceEmailFrequency }))}
                wrapperClassName="w-36 shrink-0"
              >
                <option value={event === "DIGEST_DAILY" ? "DAILY" : "WEEKLY"}>{event === "DIGEST_DAILY" ? "Daily" : "Weekly"}</option>
                <option value="OFF">Off</option>
              </Select>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending}>{pending ? "Saving..." : "Save preferences"}</Button>
        {message ? <span className="text-sm text-muted-foreground">{message}</span> : null}
      </div>
    </div>
  );
}
