// -----------------------------------------------------------------------------
// FacilityDashboard.jsx — shared implementation for the Hospital and Shelter
// portals. Both roles manage the exact same shape of data (a Facility with a
// capacity bar and a status), so rather than duplicate two nearly-identical
// pages, one component takes a `facilityType` prop and the two page files
// (HospitalDashboard.jsx / ShelterDashboard.jsx) just render it.
// -----------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import api from '../api/axiosClient.js';
import { useSocket } from '../context/SocketContext.jsx';
import Navbar from '../components/Navbar.jsx';
import IncidentMap from '../components/IncidentMap.jsx';

const LABELS = {
  hospital: { noun: 'Hospital', capacityNoun: 'beds', resourceHint: 'e.g. ICU, ambulance, oxygen, blood bank' },
  shelter: { noun: 'Shelter', capacityNoun: 'occupants', resourceHint: 'e.g. bedding, drinking water, medical tent' },
};

// Fallback used only if geolocation is unavailable/denied — Mumbai,
// matching the seeded demo data.
const FALLBACK_LOCATION = { lng: 72.8777, lat: 19.076, label: 'Mumbai (demo default)' };

export default function FacilityDashboard({ facilityType }) {
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  const labels = LABELS[facilityType];

  const { data: mineData, isLoading } = useQuery({
    queryKey: ['facilities', 'mine'],
    queryFn: async () => (await api.get('/facilities/mine')).data,
  });

  const { data: allFacilitiesData } = useQuery({
    queryKey: ['facilities'],
    queryFn: async () => (await api.get('/facilities')).data,
  });

  const { data: incidentsData } = useQuery({
    queryKey: ['incidents', 'all'],
    queryFn: async () => (await api.get('/incidents')).data,
  });

  const facility = mineData?.facility || null;

  const [registerForm, setRegisterForm] = useState({
    name: '',
    address: '',
    capacityTotal: 50,
    contactPhone: '',
    resources: '',
  });
  const [capacityUsed, setCapacityUsed] = useState(0);
  const [status, setStatus] = useState('operational');

  // Real device location for placing the facility on the map — same
  // pattern as ReportIncident.jsx, so a hospital/shelter registering from
  // anywhere in the world lands in the right place, not just near Mumbai.
  const [locationStatus, setLocationStatus] = useState('detecting');
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('denied');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lng: pos.coords.longitude, lat: pos.coords.latitude });
        setLocationStatus('live');
      },
      () => setLocationStatus('denied'),
      { timeout: 6000 }
    );
  }, []);

  useEffect(() => {
    if (facility) {
      setCapacityUsed(facility.capacityUsed);
      setStatus(facility.status);
    }
  }, [facility]);

  useEffect(() => {
    if (!socket) return;
    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['facilities'] });
    socket.on('facility:update', invalidate);
    socket.on('facility:new', invalidate);
    return () => {
      socket.off('facility:update', invalidate);
      socket.off('facility:new', invalidate);
    };
  }, [socket, queryClient]);

  const registerMutation = useMutation({
    mutationFn: async () => {
      // Use the real captured location; only fall back to Mumbai (with
      // jitter, so repeated demo registrations don't stack exactly) if
      // geolocation was denied or unavailable.
      const jitter = () => (Math.random() - 0.5) * 0.02;
      const lng = coords ? coords.lng : FALLBACK_LOCATION.lng + jitter();
      const lat = coords ? coords.lat : FALLBACK_LOCATION.lat + jitter();

      const { data } = await api.post('/facilities', {
        type: facilityType,
        name: registerForm.name,
        address: registerForm.address,
        capacityTotal: Number(registerForm.capacityTotal),
        contactPhone: registerForm.contactPhone,
        resources: registerForm.resources.split(',').map((r) => r.trim()).filter(Boolean),
        lng,
        lat,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () =>
      (await api.patch(`/facilities/${facility._id}/capacity`, { capacityUsed: Number(capacityUsed), status })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
    },
  });

  const occupancyPercent = facility?.capacityTotal
    ? Math.round((capacityUsed / facility.capacityTotal) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-console-bg">
      <Navbar />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="font-display text-2xl font-semibold text-console-mist">{labels.noun} portal</h1>
        <p className="text-sm text-console-muted">
          Keep your {labels.capacityNoun} capacity current so citizens and dispatchers see it live.
        </p>

        {isLoading ? (
          <p className="mt-6 text-sm text-console-muted">Loading…</p>
        ) : !facility ? (
          // No facility linked to this account yet — first-time setup form.
          <form
            onSubmit={(e) => {
              e.preventDefault();
              registerMutation.mutate();
            }}
            className="mt-6 max-w-md space-y-4 rounded-xl border border-console-border bg-console-surface p-6"
          >
            <p className="font-mono text-xs uppercase tracking-wide text-severity-info">
              Register your {labels.noun.toLowerCase()}
            </p>
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-console-muted">Name</label>
              <input
                required
                value={registerForm.name}
                onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                className="mt-1 w-full rounded-md border border-console-border bg-console-bg px-3 py-2 text-sm text-console-mist focus:border-brand"
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-console-muted">Address</label>
              <input
                value={registerForm.address}
                onChange={(e) => setRegisterForm({ ...registerForm, address: e.target.value })}
                className="mt-1 w-full rounded-md border border-console-border bg-console-bg px-3 py-2 text-sm text-console-mist focus:border-brand"
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-console-muted">
                Total {labels.capacityNoun}
              </label>
              <input
                type="number"
                min={1}
                required
                value={registerForm.capacityTotal}
                onChange={(e) => setRegisterForm({ ...registerForm, capacityTotal: e.target.value })}
                className="mt-1 w-full rounded-md border border-console-border bg-console-bg px-3 py-2 text-sm text-console-mist focus:border-brand"
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-console-muted">Contact phone</label>
              <input
                value={registerForm.contactPhone}
                onChange={(e) => setRegisterForm({ ...registerForm, contactPhone: e.target.value })}
                className="mt-1 w-full rounded-md border border-console-border bg-console-bg px-3 py-2 text-sm text-console-mist focus:border-brand"
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-console-muted">
                Resources (comma separated)
              </label>
              <input
                value={registerForm.resources}
                onChange={(e) => setRegisterForm({ ...registerForm, resources: e.target.value })}
                placeholder={labels.resourceHint}
                className="mt-1 w-full rounded-md border border-console-border bg-console-bg px-3 py-2 text-sm text-console-mist focus:border-brand"
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-console-border bg-console-bg px-3 py-2 text-xs">
              {locationStatus === 'detecting' && <span className="text-console-muted">📍 Detecting your location…</span>}
              {locationStatus === 'live' && <span className="text-severity-low">📍 Using your current location</span>}
              {locationStatus === 'denied' && (
                <span className="text-severity-high">📍 Location unavailable — will use {FALLBACK_LOCATION.label}</span>
              )}
            </div>
            {registerMutation.isError && (
              <p className="text-sm text-severity-critical">
                {registerMutation.error?.response?.data?.message || 'Could not register facility.'}
              </p>
            )}
            <button
              type="submit"
              disabled={registerMutation.isPending}
              className="w-full rounded-md bg-brand py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
            >
              {registerMutation.isPending ? 'Registering…' : 'Register facility'}
            </button>
          </form>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-2 space-y-4 rounded-xl border border-console-border bg-console-surface p-6">
              <p className="font-display text-lg font-semibold text-console-mist">{facility.name}</p>
              <p className="text-xs text-console-muted">{facility.location?.address}</p>

              <div>
                <div className="flex justify-between font-mono text-xs text-console-muted">
                  <span>Occupancy</span>
                  <span>{capacityUsed} / {facility.capacityTotal} ({occupancyPercent}%)</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-console-bg">
                  <div
                    className={`h-full rounded-full ${
                      occupancyPercent >= 90 ? 'bg-severity-critical' : occupancyPercent >= 60 ? 'bg-severity-high' : 'bg-severity-low'
                    }`}
                    style={{ width: `${Math.min(occupancyPercent, 100)}%` }}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={facility.capacityTotal}
                  value={capacityUsed}
                  onChange={(e) => setCapacityUsed(e.target.value)}
                  className="mt-3 w-full accent-brand"
                />
              </div>

              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-console-muted">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="mt-1 w-full rounded-md border border-console-border bg-console-bg px-3 py-2 text-sm text-console-mist focus:border-brand"
                >
                  <option value="operational">Operational</option>
                  <option value="full">Full</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              <button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
                className="w-full rounded-md bg-brand py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
              >
                {updateMutation.isPending ? 'Saving…' : 'Push live update'}
              </button>
              {updateMutation.isSuccess && (
                <p className="text-center text-xs text-severity-low">Broadcast to every open dashboard ✓</p>
              )}
            </div>

            <div className="lg:col-span-3">
              <h2 className="mb-2 font-mono text-xs uppercase tracking-wide text-console-muted">
                Regional map — your facility, other facilities, and open incidents
              </h2>
              <IncidentMap
                incidents={incidentsData?.incidents || []}
                facilities={allFacilitiesData?.facilities || []}
                height="460px"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
