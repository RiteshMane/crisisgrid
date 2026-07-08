// -----------------------------------------------------------------------------
// EmergencyDirectory.jsx — EOC-only panel answering "how do I reach the
// nearest hospital / a rescue team / a shelter operator right now?" without
// leaving the dashboard. Doubles as the review queue for the verification
// documents each org uploaded at signup (stand-in for a government ID check).
// -----------------------------------------------------------------------------

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/axiosClient.js';

const ROLE_LABELS = {
  hospital: 'Hospital',
  shelter: 'Shelter',
  rescue_team: 'Rescue Team',
  ngo: 'NGO',
  volunteer: 'Volunteer',
};

const DOC_STATUS_STYLE = {
  not_submitted: 'text-console-muted border-console-border',
  pending: 'text-severity-high border-severity-high/50',
  approved: 'text-severity-low border-severity-low/50',
  rejected: 'text-severity-critical border-severity-critical/50',
};

export default function EmergencyDirectory() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['users', 'directory'],
    queryFn: async () => (await api.get('/users/directory')).data,
  });

  const reviewDoc = useMutation({
    mutationFn: async ({ id, status }) => (await api.patch(`/users/${id}/verify-document`, { status })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users', 'directory'] }),
  });

  const directory = data?.directory || [];

  return (
    <div className="rounded-xl border border-console-border bg-console-surface p-4">
      <h2 className="font-mono text-xs uppercase tracking-wide text-console-muted">
        Emergency contact directory ({directory.length})
      </h2>
      <p className="mt-1 text-xs text-console-muted">
        Every hospital, shelter, rescue team, and NGO account — with live capacity where available.
      </p>

      <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1">
        {isLoading && <p className="text-xs text-console-muted">Loading directory…</p>}

        {directory.map((entry) => (
          <div key={entry._id} className="rounded-md border border-console-border p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-display text-sm text-console-mist">
                  {entry.organizationName || entry.name}
                </p>
                <p className="font-mono text-[11px] uppercase text-console-muted">
                  {ROLE_LABELS[entry.role]} {entry.phone && `· 📞 ${entry.phone}`}
                </p>
              </div>
              <span
                className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase ${DOC_STATUS_STYLE[entry.documentStatus]}`}
              >
                {entry.documentStatus.replace('_', ' ')}
              </span>
            </div>

            {entry.facility && (
              <p className="mt-1 font-mono text-[11px] text-console-muted">
                Capacity: {entry.facility.capacityUsed}/{entry.facility.capacityTotal} · {entry.facility.status}
              </p>
            )}

            {entry.documentStatus === 'pending' && (
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => reviewDoc.mutate({ id: entry._id, status: 'approved' })}
                  disabled={reviewDoc.isPending}
                  className="rounded border border-severity-low px-2 py-0.5 font-mono text-[10px] uppercase text-severity-low hover:bg-severity-low/10"
                >
                  Approve document
                </button>
                <button
                  onClick={() => reviewDoc.mutate({ id: entry._id, status: 'rejected' })}
                  disabled={reviewDoc.isPending}
                  className="rounded border border-severity-critical px-2 py-0.5 font-mono text-[10px] uppercase text-severity-critical hover:bg-severity-critical/10"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}

        {!isLoading && directory.length === 0 && (
          <p className="rounded-md border border-dashed border-console-border p-3 text-xs text-console-muted">
            No hospitals, shelters, rescue teams, or NGOs have registered yet.
          </p>
        )}
      </div>
    </div>
  );
}
