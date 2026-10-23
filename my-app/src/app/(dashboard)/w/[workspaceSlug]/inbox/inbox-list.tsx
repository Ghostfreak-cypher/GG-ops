"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  MessageSquare,
  AtSign,
  CheckSquare,
  CheckCheck,
  Inbox as InboxIcon,
  type LucideIcon,
} from "lucide-react";
import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from "@/modules/notification/server/actions/mark-read";
import type { NotificationDTO } from "@/modules/notification/server/queries";
import { Button } from "@/components/ui/button";
import { getPlainText } from "@/lib/get-plain-text";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function fmt(iso: string) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return iso.slice(0, 10);
}

function iconFor(type: string): LucideIcon {
  const t = type.toUpperCase();
  if (t.includes("MENTION")) return AtSign;
  if (t.includes("COMMENT")) return MessageSquare;
  if (t.includes("ASSIGN") || t.includes("TASK")) return CheckSquare;
  return Bell;
}

export function InboxList({
  notifications,
  // No longer used here — the realtime subscription this fed moved up to SidebarNav (see
  // the comment below). Kept in the prop type so the caller (page.tsx) doesn't need to
  // change for what is otherwise a dead argument.
  userId: _userId,
  workspaceSlug,
}: {
  notifications: NotificationDTO[];
  userId: string;
  workspaceSlug: string;
}) {
  const router = useRouter();
  // Realtime refresh for this channel/event is already subscribed by the always-mounted
  // dashboard layout's SidebarNav — a second identical subscription here just doubled the
  // refetch. Its router.refresh() re-renders this whole route, this list included.
  const [pending, start] = useTransition();
  const hasUnread = notifications.some((n) => !n.isRead);

  return (
    <div className="space-y-3">
      {hasUnread && (
        <div className="flex justify-end">
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await markAllNotificationsReadAction();
                router.refresh();
              })
            }
          >
            <CheckCheck className="size-4" />
            Mark all read
          </Button>
        </div>
      )}

      {notifications.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-6 text-center sm:p-10">
          <InboxIcon className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nothing here yet.</p>
        </Card>
      ) : (
        <Card className="divide-y divide-border overflow-hidden p-0">
          {notifications.map((n) => {
            const Icon = iconFor(n.type);
            return (
              <div
                key={n.id}
                className={cn(
                  "flex flex-wrap items-start gap-3 px-4 py-3 text-sm transition-colors sm:flex-nowrap",
                  !n.isRead && "bg-muted",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full",
                    n.isRead
                      ? "bg-secondary text-muted-foreground"
                      : "bg-primary/10 text-primary",
                  )}
                >
                  <Icon className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 font-medium wrap-break-word">{n.title}</span>
                    {!n.isRead && (
                      <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                  {n.taskTitle && n.body && (
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      on <span className="font-medium text-foreground">{n.taskTitle}</span>
                    </div>
                  )}
                  {n.body && (
                    <div className="whitespace-pre-line wrap-break-word text-xs text-muted-foreground">
                      {getPlainText(n.body)}
                    </div>
                  )}
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {fmt(n.createdAt)}
                  </div>
                </div>
                {/* Below sm the actions drop under the text (pl-10 = icon + gap) so they
                    don't squeeze the message into a sliver. */}
                <div className="flex w-full shrink-0 items-center gap-3 pl-10 sm:w-auto sm:pl-0">
                  {n.projectId && n.entityId && (
                    <button
                      type="button"
                      className="text-xs font-medium text-primary transition-opacity hover:opacity-70 pointer-coarse:min-h-11"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          if (!n.isRead) await markNotificationReadAction(n.id);
                          router.push(
                            `/w/${workspaceSlug}/projects/${n.projectId}/tasks/${n.entityId}`,
                          );
                        })
                      }
                    >
                      View task
                    </button>
                  )}
                  {!n.isRead && (
                    <button
                      type="button"
                      className="text-xs text-muted-foreground transition-colors hover:text-foreground pointer-coarse:min-h-11"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          await markNotificationReadAction(n.id);
                          router.refresh();
                        })
                      }
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
