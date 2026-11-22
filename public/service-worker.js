const CACHE_NAME = "modify-app-shell-v22";
const APP_SHELL = ["/", "/manifest.webmanifest", "/logo.svg", "/icons/modify.svg", "/shared-app.js?v=134"];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(APP_SHELL.map(async path => {
      try {
        const response = await fetch(path, { cache: "reload" });
        if (response.ok) await cache.put(path, response);
      } catch (_) {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("modify-app-shell-") && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Prefer the live site so staff receive the latest app. Use the cached shell
  // only when offline; never cache API responses, logins, records or photos.
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response.ok && (request.mode === "navigate" || APP_SHELL.includes(url.pathname))) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request.mode === "navigate" ? "/" : request, response.clone());
      }
      return response;
    } catch (_) {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request.mode === "navigate" ? "/" : request);
      if (cached) return cached;
      return new Response("MODIFY is offline. Reconnect to the internet to use company records.", {
        status: 503,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
      });
    }
  })());
});
