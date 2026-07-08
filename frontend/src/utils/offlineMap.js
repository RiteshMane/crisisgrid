// -----------------------------------------------------------------------------
// offlineMap.js — lets a citizen proactively download every map tile within
// a chosen radius of a point, before connectivity drops. Without this, the
// service worker (sw.js) only caches tiles you happen to have scrolled past
// — fine for casual offline resilience, but not enough to guarantee a whole
// area is available ahead of time, which is the actual ask during a crisis.
//
// The math here is the standard "slippy map" tile-coordinate conversion
// used by every OSM-based tool — converting a lat/lng + zoom level into the
// specific tile X/Y indices that cover it.
// -----------------------------------------------------------------------------

const TILE_SIZE_DEG_FACTOR = Math.PI / 180;

function lngToTileX(lng, zoom) {
  return Math.floor(((lng + 180) / 360) * 2 ** zoom);
}

function latToTileY(lat, zoom) {
  const latRad = lat * TILE_SIZE_DEG_FACTOR;
  return Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * 2 ** zoom
  );
}

// Rough degrees-per-km at a given latitude — good enough for choosing a
// download radius, not for precision navigation.
function kmToDegrees(km, lat) {
  const latDegrees = km / 111; // ~111km per degree of latitude, everywhere
  const lngDegrees = km / (111 * Math.cos((lat * Math.PI) / 180));
  return { latDegrees, lngDegrees };
}

/**
 * Returns every tile URL covering a circular-ish area (approximated as a
 * bounding box, which is simpler and slightly over-covers the circle —
 * acceptable since extra edge tiles just mean a little more disk cache,
 * not a correctness problem) around a center point, across a small range
 * of zoom levels useful for both an overview and street-level detail.
 */
export function computeTileUrls({ lat, lng, radiusKm, minZoom = 12, maxZoom = 15 }) {
  const urls = [];
  const { latDegrees, lngDegrees } = kmToDegrees(radiusKm, lat);

  const bounds = {
    north: lat + latDegrees,
    south: lat - latDegrees,
    east: lng + lngDegrees,
    west: lng - lngDegrees,
  };

  for (let z = minZoom; z <= maxZoom; z++) {
    const xMin = lngToTileX(bounds.west, z);
    const xMax = lngToTileX(bounds.east, z);
    const yMin = latToTileY(bounds.north, z);
    const yMax = latToTileY(bounds.south, z);

    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        // Round-robin across OSM's a/b/c tile subdomains, same as the
        // TileLayer URL template used elsewhere in the app.
        const subdomain = ['a', 'b', 'c'][(x + y) % 3];
        urls.push(`https://${subdomain}.tile.openstreetmap.org/${z}/${x}/${y}.png`);
      }
    }
  }

  return urls;
}

/**
 * Downloads every tile URL into the service worker's cache, in small
 * batches (to avoid opening hundreds of simultaneous connections, which
 * some browsers/networks throttle hard), reporting progress as it goes.
 */
export async function downloadTilesForOfflineUse({ lat, lng, radiusKm }, onProgress) {
  if (!('caches' in window)) {
    throw new Error('This browser does not support offline caching.');
  }

  const urls = computeTileUrls({ lat, lng, radiusKm });
  const cache = await caches.open('crisisgrid-map-tiles-v1');

  const BATCH_SIZE = 8;
  let completed = 0;

  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (url) => {
        try {
          // no-cors: OSM's tile server doesn't send CORS headers, so a
          // normal cross-origin fetch would be rejected outright. The
          // response is "opaque" (we can't read it), but the browser can
          // still store and later serve it from cache correctly.
          const response = await fetch(url, { mode: 'no-cors' });
          await cache.put(url, response);
        } catch {
          // A single failed tile (e.g. a momentary network blip) shouldn't
          // abort the whole download — just skip it and move on.
        }
        completed += 1;
        onProgress?.(completed, urls.length);
      })
    );
  }

  return { tilesDownloaded: completed, totalTiles: urls.length };
}

export async function registerMapServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch (err) {
    console.warn('[offlineMap] Service worker registration failed:', err.message);
    return null;
  }
}
