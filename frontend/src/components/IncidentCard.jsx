import { useMutation, useQueryClient } from '@tanstack/react-query';
import SeverityBadge from './SeverityBadge.jsx';
import TrustBadge from './TrustBadge.jsx';
import api from '../api/axiosClient.js';
import { useAuth } from '../context/AuthContext.jsx';

function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const AUTHORITY_ROLES = ['eoc', 'admin', 'rescue_team'];

export default function IncidentCard({ incident, onClick, actions }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Patches the single updated incident directly into every cached incidents
  // list (['incidents','all'], ['incidents','mine'], etc — setQueriesData
  // matches any query key starting with 'incidents') instead of invalidating
  // and re-fetching the whole list. The server already sends back the full,
  // authoritative updated incident in its response — refetching to get the
  // same data again was pure wasted latency, which is what made
  // confirm/dispute/verify feel slow (a write + a full list re-read instead
  // of just the write).
  const patchIncidentInCache = (updatedIncident) => {
    queryClient.setQueriesData({ queryKey: ['incidents'] }, (old) => {
      if (!old?.incidents) return old;
      return {
        ...old,
        incidents: old.incidents.map((i) => (i._id === updatedIncident._id ? updatedIncident : i)),
      };
    });
  };

  const crowdVerify = useMutation({
    mutationFn: async (vote) => (await api.post(`/incidents/${incident._id}/crowd-verify`, { vote })).data,
    onSuccess: (data) => patchIncidentInCache(data.incident),
  });

  const authorityVerify = useMutation({
    mutationFn: async (status) =>
      (await api.patch(`/incidents/${incident._id}/authority-verify`, { status })).data,
    onSuccess: (data) => patchIncidentInCache(data.incident),
  });

  const isOwnReport = incident.reportedBy?._id === user?._id || incident.reportedBy === user?._id;
  const myVote = incident.crowdVotes?.find((v) => (v.user?._id || v.user) === user?._id)?.vote;
  const canActAsAuthority = AUTHORITY_ROLES.includes(user?.role);
  const alreadyDecided = incident.authorityVerification?.status !== 'pending';

  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-lg border border-console-border bg-console-surface p-4 transition hover:border-brand/60"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-sm font-medium text-console-mist">{incident.title}</p>
          <p className="mt-1 line-clamp-2 text-xs text-console-muted">{incident.description}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <SeverityBadge severity={incident.severity} />
          <TrustBadge verification={incident.verification} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 font-mono text-[11px] text-console-muted">
        <span className="rounded border border-console-border px-1.5 py-0.5 uppercase">{incident.status}</span>
        <span className="rounded border border-console-border px-1.5 py-0.5 uppercase">{incident.category}</span>
        <span>{incident.location?.address || 'Location on file'}</span>
        <span className="ml-auto">{formatTime(incident.createdAt)}</span>
      </div>

      {incident.aiAnalysis?.summary && (
        <p className="mt-2 border-t border-console-border pt-2 text-xs italic text-console-muted">
          <span className="font-mono not-italic text-severity-info">AI ·</span> {incident.aiAnalysis.summary}
        </p>
      )}

      {/* AI resource recommendation — an internal dispatch checklist for ops
          staff. Deliberately hidden from citizens: it's not useful to the
          person who filed the report, and a raw "3 ambulances, 15 min ETA"
          readout can read as alarming rather than reassuring. Citizens see
          <EmergencyContacts> instead (see CitizenDashboard.jsx). */}
      {canActAsAuthority && incident.aiAnalysis?.recommendedResources?.length > 0 && (
        <div className="mt-2 rounded-md border border-severity-info/30 bg-severity-info/5 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-wide text-severity-info">Recommended deployment</p>
          <ul className="mt-1 space-y-0.5">
            {incident.aiAnalysis.recommendedResources.map((r) => (
              <li key={r.name} className="flex items-center gap-1.5 text-xs text-console-mist">
                <span className="text-severity-low">✓</span>
                {r.qty > 1 ? `${r.qty}× ${r.name}` : r.name}
              </li>
            ))}
          </ul>
          {incident.aiAnalysis.etaMinutes && (
            <p className="mt-1 font-mono text-[10px] text-console-muted">
              Estimated response: <span className="text-console-mist">{incident.aiAnalysis.etaMinutes} minutes</span>
            </p>
          )}
        </div>
      )}

      {/* Crowd verification — anyone except the original reporter can weigh in. */}
      {!isOwnReport && incident.status !== 'rejected' && (
        <div className="mt-3 flex items-center gap-2 border-t border-console-border pt-2" onClick={(e) => e.stopPropagation()}>
          <span className="font-mono text-[10px] uppercase text-console-muted">Does this look real?</span>
          <button
            onClick={() => crowdVerify.mutate('confirm')}
            disabled={crowdVerify.isPending}
            className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase ${
              myVote === 'confirm'
                ? 'border-severity-low bg-severity-low/10 text-severity-low'
                : 'border-console-border text-console-muted hover:text-severity-low'
            }`}
          >
            ✓ Confirm
          </button>
          <button
            onClick={() => crowdVerify.mutate('dispute')}
            disabled={crowdVerify.isPending}
            className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase ${
              myVote === 'dispute'
                ? 'border-severity-critical bg-severity-critical/10 text-severity-critical'
                : 'border-console-border text-console-muted hover:text-severity-critical'
            }`}
          >
            ✗ Dispute
          </button>
        </div>
      )}

      {/* Authority verification — EOC/rescue/admin only, one-time decision. */}
      {canActAsAuthority && !alreadyDecided && (
        <div className="mt-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <span className="font-mono text-[10px] uppercase text-console-muted">Authority review:</span>
          <button
            onClick={() => authorityVerify.mutate('confirmed')}
            disabled={authorityVerify.isPending}
            className="rounded border border-severity-info px-2 py-0.5 font-mono text-[10px] uppercase text-severity-info hover:bg-severity-info/10"
          >
            Verify
          </button>
          <button
            onClick={() => authorityVerify.mutate('rejected')}
            disabled={authorityVerify.isPending}
            className="rounded border border-severity-critical px-2 py-0.5 font-mono text-[10px] uppercase text-severity-critical hover:bg-severity-critical/10"
          >
            Reject as fake
          </button>
        </div>
      )}
      {alreadyDecided && (
        <p className="mt-2 font-mono text-[10px] uppercase text-console-muted">
          Authority: {incident.authorityVerification.status}
        </p>
      )}

      {actions && <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>{actions}</div>}
    </div>
  );
}
