"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export type PusherCtor = new (key: string, options: { cluster: string }) => {
  subscribe: (channel: string) => {
    bind: (event: string, callback: (data: unknown) => void) => void;
    unbind: (event: string) => void;
  };
  unsubscribe: (channel: string) => void;
  disconnect: () => void;
};

declare global {
  interface Window {
    Pusher?: PusherCtor;
  }
}

let pusherScriptPromise: Promise<void> | null = null;

export function loadPusherScript(): Promise<void> {
  if (window.Pusher) return Promise.resolve();
  if (pusherScriptPromise) return pusherScriptPromise;
  pusherScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://js.pusher.com/8.4.0/pusher.min.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Pusher client"));
    document.head.appendChild(script);
  });
  return pusherScriptPromise;
}

export function usePusherRefresh(channel: string, events: string[]) {
  const router = useRouter();

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!key || !cluster || events.length === 0) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    void loadPusherScript()
      .then(() => {
        if (cancelled || !window.Pusher) return;
        const client = new window.Pusher(key, { cluster });
        const subscription = client.subscribe(channel);
        for (const event of events) subscription.bind(event, () => router.refresh());
        cleanup = () => {
          for (const event of events) subscription.unbind(event);
          client.unsubscribe(channel);
          client.disconnect();
        };
      })
      .catch(() => {
        // Realtime is optional; the page still refreshes through normal navigation/actions.
      });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [channel, events, router]);
}