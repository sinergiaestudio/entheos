const CACHE_NAME = "entheos-static-v4";
const SAFE_STATIC = [
  "/manifest.webmanifest",
  "/entheos-mark.png",
  "/app/icon-64.png",
  "/app/icon-192.png",
  "/app/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SAFE_STATIC))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !SAFE_STATIC.includes(url.pathname)) return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

// Navigations, authentication, HTML and /api responses deliberately remain
// network-only. IndexedDB stores only the last private view and unsent drafts.
