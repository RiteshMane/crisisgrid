import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/axiosClient.js';
import { useSocket } from '../context/SocketContext.jsx';
import Navbar from '../components/Navbar.jsx';
import IncidentMap from '../components/IncidentMap.jsx';
import IncidentCard from '../components/IncidentCard.jsx';
import EmergencyContacts from '../components/EmergencyContacts.jsx';
import OfflineMapControl from '../components/OfflineMapControl.jsx';

// Fallback used only if geolocation is unavailable/denied — matches the
// seeded demo data's location so the offline download still has somewhere
// sensible to center on.
const FALLBACK_CENTER = [19.076, 72.8777];

export default function CitizenDashboard() {
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  const [myLocation, setMyLocation] = useState(FALLBACK_CENTER);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setMyLocation([pos.coords.latitude, pos.coords.longitude]),
      () => setMyLocation(FALLBACK_CENTER),
      { timeout: 6000 }
    );
  }, []);

  const { data: myIncidentsData } = useQuery({
    queryKey: ['incidents', 'mine'],
    queryFn: async () => (await api.get('/incidents?mine=true')).data,
  });

  const { data: facilitiesData } = useQuery({
    queryKey: ['facilities'],
    queryFn: async () => (await api.get('/facilities')).data,
  });

  const { data: allIncidentsData } = useQuery({
    queryKey: ['incidents', 'all'],
    queryFn: async () => (await api.get('/incidents')).data,
  });

  // Live updates: whenever the server broadcasts a new/changed incident,
  // just invalidate the relevant queries so React Query refetches. Simpler
  // and less bug-prone than manually splicing the socket payload into cache.
  useEffect(() => {
    if (!socket) return;
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
    };
    socket.on('incident:new', invalidate);
    socket.on('incident:update', invalidate);
    socket.on('facility:update', invalidate);
    return () => {
      socket.off('incident:new', invalidate);
      socket.off('incident:update', invalidate);
      socket.off('facility:update', invalidate);
    };
  }, [socket, queryClient]);

  const myIncidents = myIncidentsData?.incidents || [];
  const facilities = facilitiesData?.facilities || [];
  const allIncidents = allIncidentsData?.incidents || [];

  return (
    <div className="min-h-screen bg-console-bg">
      <Navbar />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-console-mist">Citizen dashboard</h1>
            <p className="text-sm text-console-muted">Your reports, and everything nearby right now.</p>
          </div>
          <Link
            to="/citizen/report"
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            + Report incident / SOS
          </Link>
        </div>

        <div className="mt-6">
          <EmergencyContacts />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3 space-y-4">
            <div>
              <h2 className="mb-2 font-mono text-xs uppercase tracking-wide text-console-muted">
                Live map — incidents &amp; nearby shelters/hospitals
              </h2>
              <IncidentMap incidents={allIncidents} facilities={facilities} height="480px" />
            </div>
            <OfflineMapControl center={myLocation} />
          </div>

          <div className="lg:col-span-2">
            <h2 className="mb-2 font-mono text-xs uppercase tracking-wide text-console-muted">Your reports</h2>
            <div className="space-y-3">
              {myIncidents.length === 0 && (
                <p className="rounded-lg border border-dashed border-console-border p-4 text-sm text-console-muted">
                  You haven't reported anything yet. Reports you submit will appear here with live status updates.
                </p>
              )}
              {myIncidents.map((incident) => (
                <IncidentCard key={incident._id} incident={incident} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
