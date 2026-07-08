// -----------------------------------------------------------------------------
// sw.js — a minimal service worker whose only job is caching OpenStreetMap
// map tiles so the map stays usable when connectivity drops mid-disaster —
// exactly the scenario this app exists for.
//
// Strategy: "cache falling back to network, refresh cache in the background."
// - If a tile is already cached, serve it immediately (instant, works offline).
// - Whether or not it was cached, also fetch a fresh copy in the background
//   and update the cache — so tiles stay reasonably current when online,
//   without ever blocking on the network when a cached copy exists.
//
// This file must live in /public (not /src) so Vite copies it to the site's
// root unmodified — service workers only control pages within their own
// scope, and the root scope is what lets this cover the whole app.
// -----------------------------------------------------------------------------

const TILE_CACHE = 'crisisgrid-map-tiles-v1';
const TILE_HOST_PATTERN = /tile\.openstreetmap\.org/;

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Only intercept map tile requests — everything else (the API, the app
  // bundle itself) passes through untouched, so this never interferes with
  // normal app behavior or auth.
  if (!TILE_HOST_PATTERN.test(url)) return;

  event.respondWith(
    caches.open(TILE_CACHE).then(async (cache) => {
      const cached = await cache.match(event.request);

      const networkFetch = fetch(event.request, { mode: 'no-cors' })
        .then((response) => {
          // Tile responses from a different origin are "opaque" (no-cors),
          // meaning we can't inspect their status — but they can still be
          // cached and served correctly by the browser later.
          cache.put(event.request, response.clone());
          return response;
        })
        .catch(() => null); // offline — nothing to refresh with, that's fine

      // Serve the cached tile instantly if we have one; otherwise wait for
      // the network attempt (which will fail gracefully if truly offline).
      return cached || (await networkFetch) || new Response('', { status: 504 });
    })
  );
});
