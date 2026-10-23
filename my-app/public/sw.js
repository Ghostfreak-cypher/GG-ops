// Hand-written, not a build-step plugin (Serwist/next-pwa need webpack; this repo runs
// Turbopack for dev and build). Deliberately narrow: speed for static assets, and a
// branded fallback when the network is unreachable. No offline data, no push.
//
// Versioned via the query string on the registration URL (src/components/
// service-worker.tsx) — this file has no access to process.env, so a changed `v`
// is the only thing that makes the browser see a new script, install it, and (via
// activate below) evict every older cache.
const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE_NAME = `ggops-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-512-maskable.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Fetched (and checked) separately from the icons: cache.addAll follows
      // redirects, so if the proxy exemption for /offline.html is ever missing this
      // would otherwise silently cache the sign-in page as "the offline page" — and a
      // redirected response served to a navigation is a network error, not a fallback.
      const offlineRes = await fetch(OFFLINE_URL, { cache: "reload" });
      if (!offlineRes.ok || offlineRes.redirected) {
        throw new Error(`sw install: ${OFFLINE_URL} did not resolve cleanly`);
      }
      await cache.put(OFFLINE_URL, offlineRes);
      await cache.addAll(PRECACHE_URLS.filter((u) => u !== OFFLINE_URL));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

const CACHE_FIRST_PREFIXES = ["/_next/static/", "/icons/"];

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.headers.has("range")) return;

  const { pathname } = url;
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/.well-known/") ||
    pathname.startsWith("/oauth/") ||
    pathname.startsWith("/invite/")
  ) {
    return;
  }

  if (CACHE_FIRST_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        if (cached) return cached;
        const res = await fetch(request);
        if (res.ok && res.type === "basic") cache.put(request, res.clone());
        return res;
      })(),
    );
    return;
  }

  if (request.mode === "navigate") {
    // Only a network *error* (offline) falls back — a 302 from the proxy arrives as
    // an opaqueredirect and must pass straight through, and a 4xx/5xx is a real
    // response, not an offline signal.
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(OFFLINE_URL)) || Response.error();
      }),
    );
    return;
  }

  // Everything else: let the browser handle it natively.
});
