import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { dashboardPathForRole } from '../utils/roleRouting.js';

const ROLE_OPTIONS = [
  { value: 'citizen', label: 'Citizen' },
  { value: 'eoc', label: 'Emergency Operations Center' },
  { value: 'rescue_team', label: 'Rescue Team' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'shelter', label: 'Shelter' },
  { value: 'volunteer', label: 'Volunteer' },
  { value: 'ngo', label: 'NGO' },
];

const NON_CITIZEN_ROLES = ['eoc', 'hospital', 'shelter', 'rescue_team', 'ngo', 'volunteer'];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'citizen', organizationName: '' });
  const [docFile, setDocFile] = useState(null); // { dataUrl, fileName } once read
  const [docError, setDocError] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isOrgRole = form.role !== 'citizen' && form.role !== 'volunteer';
  const needsDocument = NON_CITIZEN_ROLES.includes(form.role);

  // Reads the chosen file into a base64 data URI so it can travel in the
  // same JSON request body as the rest of the registration form — no
  // separate file-upload endpoint or storage service needed for this scale.
  const handleFileChange = (e) => {
    setDocError('');
    const file = e.target.files?.[0];
    if (!file) {
      setDocFile(null);
      return;
    }
    if (!file.type.startsWith('image/')) {
      setDocError('Please upload an image file (photo or scan of your ID/registration).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setDocError('Please keep the file under 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setDocFile({ dataUrl: reader.result, fileName: file.name });
    reader.onerror = () => setDocError('Could not read that file — try a different image.');
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = { ...form };
      if (needsDocument && docFile) {
        payload.verificationDocument = docFile;
      }
      const user = await register(payload);
      navigate(dashboardPathForRole(user.role), { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-field-bg px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border border-black/5 bg-field-surface p-8 shadow-sm">
        <h1 className="font-display text-2xl font-semibold text-field-ink">Create your account</h1>
        <p className="mt-1 text-sm text-field-muted">Join the response network.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-field-muted">Full name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand"
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-field-muted">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand"
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-field-muted">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand"
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-field-muted">I am a…</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          {isOrgRole && (
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-field-muted">
                Organization name
              </label>
              <input
                value={form.organizationName}
                onChange={(e) => setForm({ ...form, organizationName: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand"
                placeholder="e.g. Sion Hospital"
              />
            </div>
          )}

          {needsDocument && (
            <div className="rounded-md border border-dashed border-gray-300 p-3">
              <label className="text-xs font-medium uppercase tracking-wide text-field-muted">
                Verification document
              </label>
              <p className="mt-1 text-xs text-field-muted">
                Upload a photo of your organization ID or registration certificate. In a production
                deployment this would be reviewed by a government official; for this demo, any
                image works and an EOC/admin account reviews it inside the app.
              </p>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="mt-2 w-full text-xs text-field-muted file:mr-2 file:rounded file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
              />
              {docFile && <p className="mt-1 text-xs text-severity-low">✓ {docFile.fileName} ready to upload</p>}
              {docError && <p className="mt-1 text-xs text-severity-critical">{docError}</p>}
            </div>
          )}

          {error && <p className="text-sm text-severity-critical">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-brand py-2 text-sm font-medium text-white transition hover:bg-brand-dark disabled:opacity-60"
          >
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-field-muted">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
