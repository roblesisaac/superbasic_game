const CACHE_NAME = "game-cache-v1";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./js/game.js",
  "./js/budget.js",
  "./js/canvas.js",
  "./js/collectibles.js",
  "./js/constants.js",
  "./js/controlledGate.js",
  "./js/gates.js",
  "./js/globals.js",
  "./js/hud.js",
  "./js/input.js",
  "./js/rides.js",
  "./js/settings.js",
  "./js/sprite.js",
  "./js/utils.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// Install: pre-cache core assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

// Activate: cleanup old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

// Fetch:
// - HTML: network-first to get latest, fallback to cache
// - Everything else: cache-first, then network, then cache fallback
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const isHTML = req.headers.get("accept")?.includes("text/html");

  if (isHTML) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("./")))
    );
  } else {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((res) => {
            // Cache same-origin GET responses at runtime
            const url = new URL(req.url);
            if (url.origin === self.location.origin && res.ok) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
            }
            return res;
          })
          .catch(() => caches.match(req)); // last-ditch cache fallback
      })
    );
  }
});
