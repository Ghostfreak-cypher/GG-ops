"use client";

import { usePusherRefresh } from "@/lib/use-pusher-refresh";

/**
 * Holds the workspace shell's single `notification.created` subscription.
 *
 * This used to live in SidebarNav, which is now rendered twice — once in the
 * desktop aside, once in the mobile drawer. usePusherRefresh opens a new Pusher
 * client per mount, so leaving it there would have re-introduced the duplicate
 * WebSocket that 93d15ad removed. Mounted once by the layout instead.
 */
export function NotificationRefresh({ userId }: { userId: string }) {
  usePusherRefresh(`user-${userId}`, ["notification.created"]);
  return null;
}
