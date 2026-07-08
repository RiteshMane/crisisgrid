// -----------------------------------------------------------------------------
// geo.js — small geospatial helpers shared by the trust-score service.
// -----------------------------------------------------------------------------

const EARTH_RADIUS_METERS = 6371000;

/**
 * Haversine distance between two [lng, lat] points, in meters.
 */
function distanceMeters([lng1, lat1], [lng2, lat2]) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

module.exports = { distanceMeters };
