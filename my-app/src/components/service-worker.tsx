"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js in production for launch-speed caching + the offline fallback.
 * In development it does the opposite — unregisters and clears caches — so a worker
 * left over from a local production test (`next build && next start`) can't serve
 * stale Turbopack chunks to `next dev`. One extra reload is needed right after
 * switching modes for the unregister to take effect.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) void reg.unregister();
      });
      if ("caches" in window) {
        void caches.keys().then((keys) => {
          for (const key of keys) void caches.delete(key);
        });
      }
      return;
    }

    const register = () => {
      void navigator.serviceWorker.register(
        `/sw.js?v=${process.env.NEXT_PUBLIC_SW_VERSION}`,
        { scope: "/", updateViaCache: "none" },
      );
    };

    // A bare `load` listener here can miss the event entirely on a fast page —
    // effects flush in a later task and `load` may have already fired.
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
