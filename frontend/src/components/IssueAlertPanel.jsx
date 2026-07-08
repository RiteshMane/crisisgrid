// -----------------------------------------------------------------------------
// IssueAlertPanel.jsx — lets the EOC broadcast a top-bar notification (e.g.
// "Flash flood warning — evacuate low-lying areas near Hindmata") to every
// connected dashboard instantly via Socket.IO, and manage/dismiss active ones.
// -----------------------------------------------------------------------------

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/axiosClient.js';

const SEVERITIES = [
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'High risk' },
];

export default function IssueAlertPanel() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState('warning');

  const { data } = useQuery({
    queryKey: ['alerts', 'active'],
    queryFn: async () => (await api.get('/alerts/active')).data,
  });

  const issue = useMutation({
    mutationFn: async () => (await api.post('/alerts', { message, severity })).data,
    onSuccess: () => {
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['alerts', 'active'] });
    },
  });

  const dismiss = useMutation({
    mutationFn: async (id) => (await api.patch(`/alerts/${id}/dismiss`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts', 'active'] }),
  });

  const activeAlerts = data?.alerts || [];

  return (
    <div className="rounded-xl border border-console-border bg-console-surface p-4">
      <h2 className="font-mono text-xs uppercase tracking-wide text-console-muted">Broadcast a notification</h2>
      <p className="mt-1 text-xs text-console-muted">
        Appears instantly in the top bar of every citizen, responder, and facility dashboard.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (message.trim()) issue.mutate();
        }}
        className="mt-3 space-y-2"
      >
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          placeholder="e.g. Flash flood warning — evacuate low-lying areas near Hindmata immediately."
          className="w-full rounded-md border border-console-border bg-console-bg px-3 py-2 text-sm text-console-mist focus:border-brand"
        />
        <div className="flex items-center gap-2">
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="rounded-md border border-console-border bg-console-bg px-2 py-1.5 text-xs text-console-mist"
          >
            {SEVERITIES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={issue.isPending || !message.trim()}
            className="rounded-md bg-brand px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {issue.isPending ? 'Broadcasting…' : 'Broadcast now'}
          </button>
        </div>
      </form>

      {activeAlerts.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-console-border pt-3">
          <p className="font-mono text-[11px] uppercase tracking-wide text-console-muted">Active broadcasts</p>
          {activeAlerts.map((alert) => (
            <div key={alert._id} className="flex items-center justify-between gap-2 rounded border border-console-border px-2 py-1.5">
              <span className="text-xs text-console-mist">{alert.message}</span>
              <button
                onClick={() => dismiss.mutate(alert._id)}
                className="shrink-0 font-mono text-[10px] uppercase text-console-muted hover:text-severity-critical"
              >
                Retract
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
