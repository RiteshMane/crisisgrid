import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { dashboardPathForRole } from '../utils/roleRouting.js';
import AlertBanner from './AlertBanner.jsx';
import AssistantChat from './AssistantChat.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      <nav className="flex items-center justify-between border-b border-console-border bg-console-surface px-6 py-3">
        <Link to={user ? dashboardPathForRole(user.role) : '/'} className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-brand" />
          <span className="font-display text-lg font-semibold tracking-tight text-console-mist">
            Crisis<span className="text-brand">Grid</span>
          </span>
        </Link>

        <div className="flex items-center gap-4 font-mono text-xs text-console-muted">
          <span className="hidden items-center gap-1.5 sm:flex">
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-severity-low' : 'bg-severity-critical'}`} />
            {connected ? 'LIVE' : 'OFFLINE'}
          </span>
          {user && (
            <>
              <span className="hidden sm:inline text-console-mist">{user.name}</span>
              <span className="rounded border border-console-border px-2 py-0.5 uppercase">{user.role}</span>
              <button
                onClick={handleLogout}
                className="rounded border border-console-border px-3 py-1 text-console-mist transition hover:border-brand hover:text-brand"
              >
                Log out
              </button>
            </>
          )}
        </div>
      </nav>
      {/* Every authenticated page includes <Navbar>, so mounting the alert
          banner and assistant chat here means both reach every role's
          screen without wiring them into each dashboard separately. */}
      {user && <AlertBanner />}
      {user && <AssistantChat />}
    </>
  );
}
