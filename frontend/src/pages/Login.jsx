import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { dashboardPathForRole } from '../utils/roleRouting.js';

const DEMO_ACCOUNTS = [
  { label: 'Citizen', email: 'citizen@demo.crisisgrid.app' },
  { label: 'EOC Control', email: 'eoc@demo.crisisgrid.app' },
  { label: 'Rescue Team', email: 'rescue@demo.crisisgrid.app' },
];
const DEMO_PASSWORD = 'Demo@1234';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const user = await login(form.email, form.password);
      const redirectTo = location.state?.from?.pathname || dashboardPathForRole(user.role);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = (email) => setForm({ email, password: DEMO_PASSWORD });

  return (
    <div className="flex min-h-screen items-center justify-center bg-field-bg px-4">
      <div className="w-full max-w-sm rounded-xl border border-black/5 bg-field-surface p-8 shadow-sm">
        <h1 className="font-display text-2xl font-semibold text-field-ink">Sign in to CrisisGrid</h1>
        <p className="mt-1 text-sm text-field-muted">Coordinate faster. Respond smarter.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-field-muted">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-field-muted">Password</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-severity-critical">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-brand py-2 text-sm font-medium text-white transition hover:bg-brand-dark disabled:opacity-60"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 rounded-md border border-dashed border-gray-300 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-field-muted">Quick demo access</p>
          <p className="mt-1 text-xs text-field-muted">
            Run <code className="font-mono">npm run seed</code> in the backend once, then jump in as any role:
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => fillDemo(acc.email)}
                className="rounded border border-gray-300 px-2 py-1 text-xs text-field-ink hover:border-brand hover:text-brand"
              >
                {acc.label}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-field-muted">
          No account?{' '}
          <Link to="/register" className="font-medium text-brand hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
