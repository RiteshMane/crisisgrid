import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { dashboardPathForRole } from '../utils/roleRouting.js';

const ROLES = [
  ['Citizen', 'Send an SOS, report incidents, track family safety.'],
  ['Operations Center', 'Live dashboard, AI triage, dispatch resources.'],
  ['Rescue Team', 'Real-time assignments and incident locations.'],
  ['Hospital', 'Broadcast bed availability as it changes.'],
  ['Shelter', 'Update occupancy so citizens see space in real time.'],
];

export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-field-bg text-field-ink">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-brand" />
          <span className="font-display text-lg font-semibold">
            Crisis<span className="text-brand">Grid</span>
          </span>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          {user ? (
            <Link to={dashboardPathForRole(user.role)} className="rounded-md bg-brand px-4 py-2 font-medium text-white">
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-field-ink hover:text-brand">Sign in</Link>
              <Link to="/register" className="rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark">
                Get started
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="mx-auto max-w-4xl px-6 pt-16 pb-20 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-brand">Emergency operations, unified</p>
        <h1 className="mt-4 font-display text-4xl font-semibold leading-tight sm:text-5xl">
          One shared picture of the disaster,<br className="hidden sm:block" /> for everyone who responds to it.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-field-muted">
          CrisisGrid connects citizens, dispatch centers, rescue teams, hospitals and shelters on a
          single real-time map — with AI-assisted triage that classifies severity the moment a
          report comes in, even before a human reads it.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/register" className="rounded-md bg-brand px-6 py-3 text-sm font-medium text-white hover:bg-brand-dark">
            Report an incident
          </Link>
          <Link to="/login" className="rounded-md border border-gray-300 px-6 py-3 text-sm font-medium hover:border-brand hover:text-brand">
            View demo login
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {ROLES.map(([title, desc]) => (
            <div key={title} className="rounded-lg border border-black/5 bg-field-surface p-5 shadow-sm">
              <p className="font-display text-sm font-semibold">{title}</p>
              <p className="mt-2 text-xs text-field-muted">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-black/5 py-6 text-center text-xs text-field-muted">
        CrisisGrid — a portfolio project built on the MERN stack, running fully in demo mode.
      </footer>
    </div>
  );
}
