// -----------------------------------------------------------------------------
// IncidentMap.jsx — renders incidents (colored by severity) and facilities
// (shelters/hospitals) on an OpenStreetMap tile layer via react-leaflet.
//
// Known Leaflet + bundler gotcha: the default marker icon images reference
// relative paths that break under Vite/webpack. We fix this once here by
// pointing Leaflet at the CDN-hosted marker images instead of local assets.
// -----------------------------------------------------------------------------

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// Risk colors match the spec exactly: Green (Low), Yellow (Medium),
// Orange (High), Red (Critical).
const SEVERITY_COLORS = {
  low: '#2BB673',
  medium: '#F2C94C',
  high: '#F2994A',
  critical: '#E8462F',
};

// A distinct symbol per calamity category, so a glance at the map tells you
// *what* is happening, not just how bad it is.
const CATEGORY_EMOJI = {
  flood: '🌊',
  fire: '🔥',
  earthquake: '🏚️',
  medical: '🚑',
  structural: '🏗️',
  other: '❗',
};

const FADED_STATUSES = ['resolved', 'rejected', 'merged'];

// Builds a Leaflet divIcon for an incident: colored disc (risk color) with
// the category emoji inside. Critical + still-active incidents pulse via
// the same `animate-pulseBeacon` keyframe used by <SeverityBadge>; resolved/
// rejected/merged incidents fade to a dim grayscale so the map visually
// "clears" as a disaster is brought under control, without incidents
// disappearing outright (they stay clickable for the record).
function incidentIcon(incident) {
  const color = SEVERITY_COLORS[incident.severity] || SEVERITY_COLORS.medium;
  const emoji = CATEGORY_EMOJI[incident.category] || CATEGORY_EMOJI.other;
  const isFaded = FADED_STATUSES.includes(incident.status);
  const shouldPulse = incident.severity === 'critical' && !isFaded;

  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative; width:34px; height:34px; display:flex; align-items:center; justify-content:center;
                  opacity:${isFaded ? 0.35 : 1}; filter:${isFaded ? 'grayscale(1)' : 'none'};">
        ${
          shouldPulse
            ? `<span class="animate-pulseBeacon" style="position:absolute; width:34px; height:34px; border-radius:9999px; background:${color};"></span>`
            : ''
        }
        <span style="position:relative; width:28px; height:28px; border-radius:9999px; background:${color};
                     border:2px solid white; box-shadow:0 1px 4px rgba(0,0,0,0.4);
                     display:flex; align-items:center; justify-content:center; font-size:14px;">
          ${emoji}
        </span>
      </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

// A distinct square icon for facilities (shelters/hospitals) so they read
// differently from the circular incident markers at a glance.
const facilityIcon = (type) =>
  L.divIcon({
    className: '',
    html: `<div style="
      width:16px;height:16px;border-radius:3px;
      background:${type === 'hospital' ? '#3E8EDE' : '#9B7EDE'};
      border:2px solid white; box-shadow:0 0 0 1px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

// react-leaflet's <MapContainer center> prop only sets the INITIAL view —
// it deliberately ignores updates after mount (so it doesn't fight a user
// who's panned around). But incidents/facilities usually load a moment
// after the map first mounts, so without this helper the map would stay
// stuck wherever the fallback `center` prop pointed. This component uses
// the imperative Leaflet map instance to jump to the real data exactly
// once, the first time any coordinates arrive — never again after that, so
// it doesn't yank the view out from under someone who's since panned away.
function AutoCenterOnData({ targetCenter, zoom }) {
  const map = useMap();
  const hasCentered = useRef(false);

  useEffect(() => {
    if (!targetCenter || hasCentered.current) return;
    map.setView(targetCenter, zoom);
    hasCentered.current = true;
  }, [targetCenter, zoom, map]);

  return null;
}

// When the person clicks an incident in the sidebar feed (not on the map
// itself), this flies the map to that incident's exact location and opens
// its popup — without this, there'd be no obvious link between "an item in
// a list" and "a pin somewhere on a map you'd have to hunt for yourself."
function FlyToIncident({ incidentId, incidents, markerRefs }) {
  const map = useMap();

  useEffect(() => {
    if (!incidentId) return;
    const incident = incidents.find((i) => i._id === incidentId);
    if (!incident) return;

    const [lng, lat] = incident.location.coordinates;
    map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 1 });

    // Open the popup slightly after the fly animation settles, rather than
    // instantly — opening it mid-flight looks glitchy and can miscalculate
    // its position since the map is still moving.
    const timer = setTimeout(() => {
      markerRefs.current[incidentId]?.openPopup();
    }, 650);

    return () => clearTimeout(timer);
  }, [incidentId, incidents, map, markerRefs]);

  return null;
}

// Averages every incident + facility coordinate into one center point, so
// the map opens wherever the real data actually is — Mumbai (or anywhere
// else) only shows up because that's where the seeded demo data happens to
// be, not because it's hardcoded as "the" location.
function computeDataCenter(incidents, facilities) {
  const points = [
    ...incidents.map((i) => i.location?.coordinates),
    ...facilities.map((f) => f.location?.coordinates),
  ].filter(Boolean);

  if (points.length === 0) return null;

  const [lngSum, latSum] = points.reduce(([lng, lat], [pLng, pLat]) => [lng + pLng, lat + pLat], [0, 0]);
  return [latSum / points.length, lngSum / points.length]; // Leaflet wants [lat, lng]
}

export default function IncidentMap({
  incidents = [],
  facilities = [],
  center = [19.076, 72.8777], // fallback ONLY used when there's no data at all yet
  zoom = 12,
  height = '100%',
  onIncidentClick,
  flyToIncidentId = null, // set this to an incident's _id to pan/zoom the map to it
}) {
  const dataCenter = computeDataCenter(incidents, facilities);
  const markerRefs = useRef({});

  return (
    <div style={{ height }} className="overflow-hidden rounded-lg border border-console-border">
      <MapContainer center={dataCenter || center} zoom={zoom} scrollWheelZoom style={{ width: '100%', height: '100%' }}>
        {/* OpenStreetMap tiles — free, no API key required. */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <AutoCenterOnData targetCenter={dataCenter} zoom={zoom} />
        <FlyToIncident incidentId={flyToIncidentId} incidents={incidents} markerRefs={markerRefs} />

        {incidents.map((incident) => {
          const [lng, lat] = incident.location.coordinates;
          return (
            <Marker
              key={incident._id}
              position={[lat, lng]}
              icon={incidentIcon(incident)}
              ref={(m) => {
                if (m) markerRefs.current[incident._id] = m;
              }}
              eventHandlers={{ click: () => onIncidentClick?.(incident) }}
            >
              <Popup>
                <div className="font-body text-sm">
                  <p className="font-semibold">{incident.title}</p>
                  <p className="text-xs uppercase text-gray-500">
                    {incident.category} · {incident.severity} · {incident.status.replace('_', ' ')}
                  </p>
                  <p className="mt-1">{incident.description}</p>
                  {incident.verification && (
                    <p className="mt-1 text-xs text-gray-500">
                      Trust score: <strong>{incident.verification.trustScore}</strong> ·{' '}
                      {incident.verification.trustState.replace('_', ' ')}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {facilities.map((facility) => {
          const [lng, lat] = facility.location.coordinates;
          return (
            <Marker key={facility._id} position={[lat, lng]} icon={facilityIcon(facility.type)}>
              <Popup>
                <div className="font-body text-sm">
                  <p className="font-semibold">{facility.name}</p>
                  <p className="text-xs uppercase text-gray-500">{facility.type}</p>
                  <p className="mt-1">
                    Capacity: {facility.capacityUsed}/{facility.capacityTotal}
                  </p>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
