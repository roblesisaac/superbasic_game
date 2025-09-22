/// <reference lib="webworker" />

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE_NAME = 'game-cache-v14';

const CORE_ASSETS: string[] = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './dist/game.js',
  './dist/budget.js',
  './dist/canvas.js',
  './dist/collectibles.js',
  './dist/constants.js',
  './dist/controlledGate.js',
  './dist/enemies.js',
  './dist/gates.js',
  './dist/globals.js',
  './dist/hud.js',
  './dist/input.js',
  './dist/rides.js',
  './dist/settings.js',
  './dist/sprite.js',
  './dist/utils.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

sw.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  void sw.skipWaiting();
});

async function notifyClientsAboutUpdate() {
  const clients = await sw.clients.matchAll({ type: 'window' });
  for (const client of clients) {
    client.postMessage({ type: 'SW_UPDATE_AVAILABLE' });
  }
}

sw.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : Promise.resolve(false)))
        )
      )
      .then(() => notifyClientsAboutUpdate())
  );
  void sw.clients.claim();
});

sw.addEventListener('fetch', (event: FetchEvent) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const isHTML = req.headers.get('accept')?.includes('text/html');

  if (isHTML) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          const url = new URL(req.url);
          if (url.origin === sw.location.origin && res.ok) {
            const copy = res.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req));
    })
  );
});
