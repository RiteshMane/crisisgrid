import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import api from '../api/axiosClient.js';
import SeverityBadge from '../components/SeverityBadge.jsx';

const CATEGORIES = ['flood', 'fire', 'earthquake', 'medical', 'structural', 'other'];

// Fallback used only if the browser has no geolocation or the user denies
// permission — Mumbai, matching the seeded demo data, so the map still has
// a sensible place to put the pin rather than failing the submission.
const FALLBACK_LOCATION = { lng: 72.8777, lat: 19.076, label: 'Mumbai (demo default)' };

export default function ReportIncident() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    type: 'incident_report',
    title: '',
    description: '',
    category: 'other',
    address: '',
  });
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Real device location — used for BOTH the incident's map pin and the
  // reporter's GPS-consistency trust signal. Captured once on mount so the
  // "detecting location…" wait happens before the citizen finishes typing,
  // not after they hit submit.
  const [locationStatus, setLocationStatus] = useState('detecting'); // 'detecting' | 'live' | 'denied'
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('denied');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lng: pos.coords.longitude, lat: pos.coords.latitude });
        setLocationStatus('live');
      },
      () => setLocationStatus('denied'),
      { timeout: 6000 }
    );
  }, []);

  const submitMutation = useMutation({
    mutationFn: async () => {
      // Use the real captured location for the incident pin itself. Only
      // fall back to the Mumbai default (with jitter, so repeated demo
      // reports don't stack exactly on top of each other) if geolocation
      // was denied or unavailable — this is what makes the app work
      // anywhere in the world, not just around the seeded demo data.
      const jitter = () => (Math.random() - 0.5) * 0.01;
      const incidentLng = coords ? coords.lng : FALLBACK_LOCATION.lng + jitter();
      const incidentLat = coords ? coords.lat : FALLBACK_LOCATION.lat + jitter();

      const { data } = await api.post('/incidents', {
        ...form,
        lng: incidentLng,
        lat: incidentLat,
        // The reporter's GPS-consistency trust signal reuses the same
        // captured coordinates — if this is your real location and it's
        // also where you're placing the incident, GPS consistency scores
        // at its maximum, exactly as it should.
        ...(coords ? { reporterLng: coords.lng, reporterLat: coords.lat } : {}),
      });
      return data;
    },
    onSuccess: () => navigate('/citizen'),
  });

  // Debounced-ish preview: fires the AI classifier once there's enough text,
  // giving the citizen instant feedback before they submit the full report.
  const handleDescriptionBlur = async () => {
    if (form.title.length < 3 || form.description.length < 10) return;
    setPreviewLoading(true);
    try {
      const { data } = await api.post('/ai/classify', { title: form.title, description: form.description });
      setPreview(data);
    } catch {
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-display text-2xl font-semibold text-console-mist">Report an incident</h1>
      <p className="mt-1 text-sm text-console-muted">
        Every field here becomes part of the incident timeline that rescue teams see.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitMutation.mutate();
        }}
        className="mt-6 space-y-4 rounded-xl border border-console-border bg-console-surface p-6"
      >
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setForm({ ...form, type: 'sos' })}
            className={`flex-1 rounded-md border py-2 text-sm font-medium ${
              form.type === 'sos'
                ? 'border-severity-critical bg-severity-critical/10 text-severity-critical'
                : 'border-console-border text-console-muted'
            }`}
          >
            🆘 SOS — immediate danger
          </button>
          <button
            type="button"
            onClick={() => setForm({ ...form, type: 'incident_report' })}
            className={`flex-1 rounded-md border py-2 text-sm font-medium ${
              form.type === 'incident_report'
                ? 'border-severity-info bg-severity-info/10 text-severity-info'
                : 'border-console-border text-console-muted'
            }`}
          >
            📝 Standard report
          </button>
        </div>

        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-console-muted">Title</label>
          <input
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="mt-1 w-full rounded-md border border-console-border bg-console-bg px-3 py-2 text-sm text-console-mist focus:border-brand"
            placeholder="e.g. Water rising near Hindmata"
          />
        </div>

        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-console-muted">Description</label>
          <textarea
            required
            rows={4}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            onBlur={handleDescriptionBlur}
            className="mt-1 w-full rounded-md border border-console-border bg-console-bg px-3 py-2 text-sm text-console-mist focus:border-brand"
            placeholder="What's happening, who's affected, and any immediate hazards."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-console-muted">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="mt-1 w-full rounded-md border border-console-border bg-console-bg px-3 py-2 text-sm text-console-mist focus:border-brand"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-console-muted">Address (optional)</label>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="mt-1 w-full rounded-md border border-console-border bg-console-bg px-3 py-2 text-sm text-console-mist focus:border-brand"
              placeholder="Nearest landmark"
            />
          </div>
        </div>

        {/* Location status — tells the citizen exactly where the pin will
            land, and lets them retry if the browser initially denied it. */}
        <div className="flex items-center justify-between rounded-md border border-console-border bg-console-bg px-3 py-2 text-xs">
          {locationStatus === 'detecting' && <span className="text-console-muted">📍 Detecting your location…</span>}
          {locationStatus === 'live' && <span className="text-severity-low">📍 Using your current location for this report</span>}
          {locationStatus === 'denied' && (
            <>
              <span className="text-severity-high">
                📍 Location unavailable — will use {FALLBACK_LOCATION.label}
              </span>
              <button
                type="button"
                onClick={() => {
                  setLocationStatus('detecting');
                  navigator.geolocation?.getCurrentPosition(
                    (pos) => {
                      setCoords({ lng: pos.coords.longitude, lat: pos.coords.latitude });
                      setLocationStatus('live');
                    },
                    () => setLocationStatus('denied'),
                    { timeout: 6000 }
                  );
                }}
                className="rounded border border-console-border px-2 py-0.5 text-console-mist hover:border-brand hover:text-brand"
              >
                Retry
              </button>
            </>
          )}
        </div>

        {/* Live AI preview panel — demonstrates the AI classification feature
            before the report is even submitted. */}
        {(previewLoading || preview) && (
          <div className="rounded-md border border-dashed border-severity-info/50 bg-severity-info/5 p-3">
            <p className="font-mono text-[11px] uppercase tracking-wide text-severity-info">AI preview</p>
            {previewLoading ? (
              <p className="mt-1 text-xs text-console-muted">Analyzing report…</p>
            ) : (
              <>
                <div className="mt-1 flex items-center gap-2">
                  <SeverityBadge severity={preview.suggestedSeverity} pulse={false} />
                  <span className="font-mono text-[11px] text-console-muted">
                    category: {preview.suggestedCategory} · source: {preview.source}
                  </span>
                </div>
                <p className="mt-1 text-xs text-console-muted">{preview.summary}</p>
              </>
            )}
          </div>
        )}

        {submitMutation.isError && (
          <p className="text-sm text-severity-critical">
            {submitMutation.error?.response?.data?.message || 'Something went wrong submitting your report.'}
          </p>
        )}

        <button
          type="submit"
          disabled={submitMutation.isPending}
          className="w-full rounded-md bg-brand py-2.5 text-sm font-medium text-white transition hover:bg-brand-dark disabled:opacity-60"
        >
          {submitMutation.isPending ? 'Submitting…' : 'Submit report'}
        </button>
      </form>
    </div>
  );
}
