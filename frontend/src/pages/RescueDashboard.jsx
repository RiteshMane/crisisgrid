import { useEffect, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import api from '../api/axiosClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import Navbar from '../components/Navbar.jsx';
import IncidentMap from '../components/IncidentMap.jsx';
import IncidentCard from '../components/IncidentCard.jsx';

export default function RescueDashboard() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);

  const { data: incidentsData } = useQuery({
    queryKey: ['incidents', 'all'],
    queryFn: async () => (await api.get('/incidents')).data,
  });

  const patchIncidentInCache = (updatedIncident) => {
    queryClient.setQueriesData({ queryKey: ['incidents'] }, (old) => {
      if (!old?.incidents) return old;
      return { ...old, incidents: old.incidents.map((i) => (i._id === updatedIncident._id ? updatedIncident : i)) };
    });
  };

  const advanceStatus = useMutation({
    mutationFn: async ({ id, status }) =>
      (await api.patch(`/incidents/${id}/status`, { status, note: 'Updated by rescue team' })).data,
    onSuccess: (data) => patchIncidentInCache(data.incident),
  });

  const selfAssign = useMutation({
    mutationFn: async ({ id }) =>
      (await api.patch(`/incidents/${id}/status`, {
        status: 'dispatched',
        assignedTeam: user._id,
        note: 'Self-assigned by rescue team',
      })).data,
    onSuccess: (data) => patchIncidentInCache(data.incident),
  });

  useEffect(() => {
    if (!socket) return;
    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['incidents'] });
    socket.on('incident:new', invalidate);
    socket.on('incident:update', invalidate);
    return () => {
      socket.off('incident:new', invalidate);
      socket.off('incident:update', invalidate);
    };
  }, [socket, queryClient]);

  const allIncidents = incidentsData?.incidents || [];
  const myAssignments = allIncidents.filter((i) => i.assignedTeam?._id === user?._id);
  const unassignedUrgent = allIncidents.filter(
    (i) => !i.assignedTeam && ['critical', 'high'].includes(i.severity) && i.status !== 'resolved'
  );

  return (
    <div className="min-h-screen bg-console-bg">
      <Navbar />
      <div className="mx-auto max-w-7xl px-4 py-6">
        <h1 className="font-display text-2xl font-semibold text-console-mist">Rescue team console</h1>
        <p className="text-sm text-console-muted">Your assignments, plus unassigned high-priority incidents nearby.</p>

        <div className="mt-6 grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <IncidentMap incidents={allIncidents} height="500px" flyToIncidentId={selectedIncidentId} />
          </div>

          <div className="space-y-6 lg:col-span-2">
            <div>
              <h2 className="mb-2 font-mono text-xs uppercase tracking-wide text-console-muted">
                Your assignments ({myAssignments.length})
              </h2>
              <div className="space-y-3">
                {myAssignments.map((incident) => (
                  <IncidentCard
                    key={incident._id}
                    incident={incident}
                    onClick={() => setSelectedIncidentId(incident._id)}
                    actions={
                      incident.status !== 'resolved' && (
                        <button
                          onClick={() => advanceStatus.mutate({ id: incident._id, status: 'resolved' })}
                          className="rounded border border-console-border px-2 py-1 font-mono text-[11px] uppercase text-severity-low hover:border-severity-low"
                        >
                          Mark resolved
                        </button>
                      )
                    }
                  />
                ))}
                {myAssignments.length === 0 && (
                  <p className="rounded-lg border border-dashed border-console-border p-4 text-sm text-console-muted">
                    No incidents assigned to you yet.
                  </p>
                )}
              </div>
            </div>

            <div>
              <h2 className="mb-2 font-mono text-xs uppercase tracking-wide text-console-muted">
                Unassigned &amp; urgent ({unassignedUrgent.length})
              </h2>
              <div className="space-y-3">
                {unassignedUrgent.map((incident) => (
                  <IncidentCard
                    key={incident._id}
                    incident={incident}
                    onClick={() => setSelectedIncidentId(incident._id)}
                    actions={
                      <button
                        onClick={() => selfAssign.mutate({ id: incident._id })}
                        className="rounded border border-console-border px-2 py-1 font-mono text-[11px] uppercase text-console-mist hover:border-brand hover:text-brand"
                      >
                        Self-assign
                      </button>
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
