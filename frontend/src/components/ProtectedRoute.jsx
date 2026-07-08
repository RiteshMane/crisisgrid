// -----------------------------------------------------------------------------
// ProtectedRoute.jsx — wraps a <Route element={...}> to require login, and
// optionally a specific role. Redirects unauthenticated users to /login and
// wrong-role users to their own dashboard instead of showing a blank page.
// -----------------------------------------------------------------------------

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { dashboardPathForRole } from '../utils/roleRouting.js';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-console-bg text-console-mist font-mono text-sm">
        Checking session…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={dashboardPathForRole(user.role)} replace />;
  }

  return children;
}
