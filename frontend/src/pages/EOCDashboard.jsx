import { useEffect, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import api from '../api/axiosClient.js';
import { useSocket } from '../context/SocketContext.jsx';
import Navbar from '../components/Navbar.jsx';
import IncidentMap from '../components/IncidentMap.jsx';
import IncidentCard from '../components/IncidentCard.jsx';
import EmergencyDirectory from '../components/EmergencyDirectory.jsx';
import IssueAlertPanel from '../components/IssueAlertPanel.jsx';

const STATUS_FLOW = ['reported', 'acknowledged', 'dispatched', 'in_progress', 'resolved'];

function nextStatus(current) {
  const idx = STATUS_FLOW.indexOf(current);
  return idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null;
}

export default function EOCDashboard() {
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  const [severityFilter, setSeverityFilter] = useState('');
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);

  const { data: incidentsData } = useQuery({
    queryKey: ['incidents', 'all'],
    queryFn: async () => (await api.get('/incidents')).data,
    refetchInterval: 30000, // safety net in case a socket event is missed
  });

  const { data: facilitiesData } = useQuery({
    queryKey: ['facilities'],
    queryFn: async () => (await api.get('/facilities')).data,
  });

  const { data: summaryData } = useQuery({
    queryKey: ['ai', 'situation-summary'],
    queryFn: async () => (await api.get('/ai/situation-summary')).data,
    refetchInterval: 20000,
  });

  const advanceStatus = useMutation({
    mutationFn: async ({ id, status }) =>
      (await api.patch(`/incidents/${id}/status`, { status, note: `Advanced to ${status} by EOC` })).data,
    onSuccess: (data) => {
      // Patch the cache directly with the server's response instead of
      // invalidating and re-fetching the whole list — removes an entire
      // round trip from the perceived latency of clicking a status button.
      queryClient.setQueriesData({ queryKey: ['incidents'] }, (old) => {
        if (!old?.incidents) return old;
        return { ...old, incidents: old.incidents.map((i) => (i._id === data.incident._id ? data.incident : i)) };
      });
      queryClient.invalidateQueries({ queryKey: ['ai', 'situation-summary'] });
    },
  });

  useEffect(() => {
    if (!socket) return;
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['ai', 'situation-summary'] });
    };
    socket.on('incident:new', invalidate);
    socket.on('incident:update', invalidate);
    socket.on('incident:escalated', invalidate);
    return () => {
      socket.off('incident:new', invalidate);
      socket.off('incident:update', invalidate);
      socket.off('incident:escalated', invalidate);
    };
  }, [socket, queryClient]);

  const allIncidents = incidentsData?.incidents || [];
  const incidents = allIncidents.filter((i) => !severityFilter || i.severity === severityFilter);
  const escalatedIncidents = allIncidents.filter((i) => i.escalated);
  const facilities = facilitiesData?.facilities || [];

  return (
    <div className="min-h-screen bg-console-bg">
      <Navbar />
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-console-mist">Operations dashboard</h1>
            <p className="text-sm text-console-muted">Live picture of every open incident across the region.</p>
          </div>

          <div className="flex gap-2">
            {['', 'critical', 'high', 'medium', 'low'].map((s) => (
              <button
                key={s || 'all'}
                onClick={() => setSeverityFilter(s)}
                className={`rounded border px-3 py-1 font-mono text-xs uppercase ${
                  severityFilter === s
                    ? 'border-brand text-brand'
                    : 'border-console-border text-console-muted hover:text-console-mist'
                }`}
              >
                {s || 'all'}
              </button>
            ))}
          </div>
        </div>

        {/* Escalated incidents — high-trust CRITICAL reports still waiting on
            dispatch. Deliberately the first thing on the page so it can
            never get buried under a long incident queue. */}
        {escalatedIncidents.length > 0 && (
          <div className="mt-4 rounded-lg border border-severity-critical/50 bg-severity-critical/10 p-3">
            <p className="font-mono text-[11px] uppercase tracking-wide text-severity-critical">
              ⚠ {escalatedIncidents.length} escalated — verified critical, not yet dispatched
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {escalatedIncidents.map((inc) => (
                <span key={inc._id} className="rounded border border-severity-critical/50 px-2 py-1 text-xs text-console-mist">
                  {inc.title}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* AI situation summary banner */}
        {summaryData && (
          <div className="mt-4 rounded-lg border border-severity-info/40 bg-severity-info/10 px-4 py-3">
            <p className="font-mono text-[11px] uppercase tracking-wide text-severity-info">AI situation summary</p>
            <p className="mt-1 text-sm text-console-mist">{summaryData.summary}</p>
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3 space-y-6">
            <div>
              <h2 className="mb-2 font-mono text-xs uppercase tracking-wide text-console-muted">Operational map</h2>
              <IncidentMap
                incidents={incidents}
                facilities={facilities}
                height="480px"
                flyToIncidentId={selectedIncidentId}
              />
            </div>
            <IssueAlertPanel />
            <EmergencyDirectory />
          </div>

          <div className="lg:col-span-2">
            <h2 className="mb-2 font-mono text-xs uppercase tracking-wide text-console-muted">
              Incident feed ({incidents.length}) — click one to locate it on the map
            </h2>
            <div className="max-h-[900px] space-y-3 overflow-y-auto pr-1">
              {incidents.map((incident) => {
                const next = nextStatus(incident.status);
                return (
                  <IncidentCard
                    key={incident._id}
                    incident={incident}
                    onClick={() => setSelectedIncidentId(incident._id)}
                    actions={
                      next && (
                        <button
                          onClick={() => advanceStatus.mutate({ id: incident._id, status: next })}
                          disabled={advanceStatus.isPending}
                          className="rounded border border-console-border px-2 py-1 font-mono text-[11px] uppercase text-console-mist hover:border-brand hover:text-brand"
                        >
                          Mark {next.replace('_', ' ')}
                        </button>
                      )
                    }
                  />
                );
              })}
              {incidents.length === 0 && (
                <p className="rounded-lg border border-dashed border-console-border p-4 text-sm text-console-muted">
                  No incidents match this filter.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
