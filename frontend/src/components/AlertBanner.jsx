// -----------------------------------------------------------------------------
// AlertBanner.jsx — the "top bar" high-risk notification the EOC can issue
// (e.g. a flash-flood warning). Fetches any currently-active alerts on
// mount so a fresh page load isn't missing one, then stays live via
// Socket.IO for new alerts / dismissals. Rendered once, inside <Navbar>,
// so every authenticated page gets it automatically.
// -----------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/axiosClient.js';
import { useSocket } from '../context/SocketContext.jsx';

const SEVERITY_STYLES = {
  info: 'bg-severity-info/15 border-severity-info text-severity-info',
  warning: 'bg-severity-high/15 border-severity-high text-severity-high',
  critical: 'bg-severity-critical/15 border-severity-critical text-severity-critical',
};

export default function AlertBanner() {
  const { socket } = useSocket();
  const [alerts, setAlerts] = useState([]);
  const [dismissedLocally, setDismissedLocally] = useState(new Set());

  const { data } = useQuery({
    queryKey: ['alerts', 'active'],
    queryFn: async () => (await api.get('/alerts/active')).data,
  });

  useEffect(() => {
    if (data?.alerts) setAlerts(data.alerts);
  }, [data]);

  useEffect(() => {
    if (!socket) return;
    const onNew = (alert) => setAlerts((prev) => [alert, ...prev]);
    const onDismissed = ({ _id }) => setAlerts((prev) => prev.filter((a) => a._id !== _id));
    socket.on('alert:new', onNew);
    socket.on('alert:dismissed', onDismissed);
    return () => {
      socket.off('alert:new', onNew);
      socket.off('alert:dismissed', onDismissed);
    };
  }, [socket]);

  const visibleAlerts = alerts.filter((a) => !dismissedLocally.has(a._id));
  if (visibleAlerts.length === 0) return null;

  return (
    <div className="space-y-1 px-4 py-2">
      {visibleAlerts.map((alert) => (
        <div
          key={alert._id}
          className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm ${
            SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.warning
          }`}
        >
          <span className="font-medium">
            <span className="mr-2 font-mono text-xs uppercase tracking-wide">
              {alert.severity === 'critical' ? '⚠ High risk' : 'Notice'}
            </span>
            {alert.message}
          </span>
          <button
            onClick={() => setDismissedLocally((prev) => new Set(prev).add(alert._id))}
            className="shrink-0 text-xs opacity-70 hover:opacity-100"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
