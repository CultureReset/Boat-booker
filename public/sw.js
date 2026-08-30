/**
 * Service worker.
 *
 * Deliberately conservative. Caching a booking flow wrong is far worse than
 * not caching it at all — a stale price or a stale calendar would be a real
 * problem — so:
 *
 *   - Static build assets: cache-first. They are content-hashed and immutable.
 *   - Navigations: network-first, falling back to a cached shell offline.
 *   - API: never cached. Availability and prices must always be live.
 *
 * The cache name carries a version; bumping it drops every older cache on
 * activate, which is the whole upgrade story.
 */

const VERSION = 'v1';
const SHELL_CACHE = `bb-shell-${VERSION}`;
const ASSET_CACHE = `bb-assets-${VERSION}`;
const OFFLINE_URL = '/offline';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, '/manifest.webmanifest']))
      // A failed precache must not block installation; the worker still works.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('bb-') && ![SHELL_CACHE, ASSET_CACHE].includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only GET is cacheable; a POST to /api/bookings must always hit the network.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Same-origin only — never interfere with third-party requests.
  if (url.origin !== self.location.origin) return;

  // The API is always live. Availability, prices and messages cannot be stale.
  if (url.pathname.startsWith('/api/')) return;

  // Immutable build output: cache-first.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
            return response;
          }),
      ),
    );
    return;
  }

  // Page navigations: network-first so content is fresh, cache as a fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached ?? caches.match(OFFLINE_URL))
            .then((cached) => cached ?? Response.error()),
        ),
    );
  }
});
