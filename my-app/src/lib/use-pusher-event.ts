"use client";

import { useEffect, useRef } from "react";
import { loadPusherScript } from "@/lib/use-pusher-refresh";

/**
 * Subscribe to a single Pusher event and run a callback when it fires. Unlike
 * `usePusherRefresh` (which calls `router.refresh()`), this lets the caller
 * update local state — useful in surfaces that aren't full-page routes (e.g. the
 * task side panel). The handler is held in a ref, so passing an inline function
 * doesn't re-subscribe.
 */
export function usePusherEvent(channel: string, event: string, handler: () => void) {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!key || !cluster) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    void loadPusherScript()
      .then(() => {
        if (cancelled || !window.Pusher) return;
        const client = new window.Pusher(key, { cluster });
        const subscription = client.subscribe(channel);
        subscription.bind(event, () => handlerRef.current());
        cleanup = () => {
          subscription.unbind(event);
          client.unsubscribe(channel);
          client.disconnect();
        };
      })
      .catch(() => {
        // Realtime is optional.
      });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [channel, event]);
}
