"use client";

import { useEffect, useState, useCallback } from "react";
// Window.Pusher type is declared in lib/use-pusher-refresh.ts (single source of truth)

let pusherScriptPromise: Promise<void> | null = null;

function loadPusherScript(): Promise<void> {
  if (typeof window !== "undefined" && window.Pusher) return Promise.resolve();
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

type ToastItem = { id: string; title: string; type: string };

const TOAST_LIMIT = 3;
const TOAST_DURATION_MS = 5000;
const NOTIFY_TYPES = new Set(["TASK_ASSIGNED", "COMMENT_MENTION"]);

function typeLabel(type: string): string {
  if (type === "TASK_ASSIGNED") return "Task assigned";
  if (type === "COMMENT_MENTION") return "Mentioned in comment";
  return "";
}

export function ToastProvider({ userId }: { userId: string }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (title: string, type: string) => {
      const id = crypto.randomUUID();
      setToasts((prev) => {
        const capped = prev.length >= TOAST_LIMIT ? prev.slice(1) : prev;
        return [...capped, { id, title, type }];
      });
      setTimeout(() => removeToast(id), TOAST_DURATION_MS);
    },
    [removeToast],
  );

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!key || !cluster) return;

    const channel = `user-${userId}`;
    const event = "notification.created";

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    void loadPusherScript()
      .then(() => {
        if (cancelled || !window.Pusher) return;
        const client = new window.Pusher(key, { cluster });
        const subscription = client.subscribe(channel);
        subscription.bind(event, (data: unknown) => {
          if (
            data !== null &&
            typeof data === "object" &&
            "type" in data &&
            "title" in data &&
            typeof (data as Record<string, unknown>).type === "string" &&
            typeof (data as Record<string, unknown>).title === "string" &&
            NOTIFY_TYPES.has((data as Record<string, unknown>).type as string)
          ) {
            const payload = data as { type: string; title: string };
            addToast(payload.title, payload.type);
          }
        });
        cleanup = () => {
          subscription.unbind(event);
          client.unsubscribe(channel);
          client.disconnect();
        };
      })
      .catch(() => {
        // Realtime is optional; toasts degrade gracefully.
      });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [userId, addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex min-w-[280px] max-w-xs items-start justify-between gap-3 border-[3px] border-neutral-700 bg-neutral-950 p-4 shadow-[4px_4px_0_0_rgba(0,0,0,0.5)]"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white">{toast.title}</p>
            {typeLabel(toast.type) && (
              <p className="mt-0.5 text-xs text-neutral-400">{typeLabel(toast.type)}</p>
            )}
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => removeToast(toast.id)}
            className="shrink-0 text-neutral-400 transition-colors hover:text-white"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
