/**
 * Celebration & Event Planner — service worker.
 *
 * The planner is a client-side SPA: once the shell is cached the whole app
 * runs offline (AI calls degrade to the deterministic offline tier, data
 * lives in localStorage). Strategy map:
 *
 *   /_next/static, /icons, static media → cache-first (immutable builds)
 *   navigations (HTML)                  → network-first, cached shell fallback
 *   other same-origin GETs              → stale-while-revalidate
 *   /api/*, POSTs, cross-origin         → never intercepted
 *
 * Registered in production only (see ServiceWorkerRegistrar.jsx) so the dev
 * server + Turbopack HMR are never held hostage by a caching layer.
 */

const VERSION = 'ceep-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const PAGES_CACHE = `${VERSION}-pages`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // allSettled: one missing asset (e.g. dev-only route) must not
      // block installation of the rest of the shell.
      await Promise.allSettled(
        PRECACHE_URLS.map((url) => cache.add(new Request(url, { cache: 'reload' })))
      );
      self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))
      );
      self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only same-origin, cache-safe reads are intercepted.
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(woff2?|png|svg|jpg|jpeg|webp|avif|ico)$/.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

/** Immutable assets: serve from cache, backfill on miss. */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (err) {
    return Response.error();
  }
}

/** HTML navigations: prefer live, fall back to the cached shell offline. */
async function networkFirstPage(request) {
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      const cache = await caches.open(PAGES_CACHE);
      cache.put('/', fresh.clone());
    }
    return fresh;
  } catch (err) {
    const cache = await caches.open(PAGES_CACHE);
    return (
      (await cache.match('/')) ||
      (await caches.match(request)) ||
      new Response(
        '<!doctype html><meta charset="utf-8"><title>Offline</title><body style="font-family:system-ui;background:#0b1220;color:#e2e8f0;display:flex;min-height:100vh;align-items:center;justify-content:center"><p>Offline — reconnect to load the planner. Your data is safe in this browser.</p></body>',
        { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      )
    );
  }
}

/** Live data with an instant cache response while it refreshes. */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then((fresh) => {
      if (fresh && fresh.ok) cache.put(request, fresh.clone());
      return fresh;
    })
    .catch(() => cached || Response.error());
  return cached || refresh;
}
