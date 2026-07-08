// -----------------------------------------------------------------------------
// OfflineMapControl.jsx — a small panel that lets a citizen download map
// tiles around a chosen point for offline use ahead of time. Placed next to
// the map rather than inside it, since it needs its own form controls
// (radius selection, progress) that don't belong inside the Leaflet canvas.
// -----------------------------------------------------------------------------

import { useState } from 'react';
import { downloadTilesForOfflineUse } from '../utils/offlineMap.js';

const RADIUS_OPTIONS = [2, 5, 10];

export default function OfflineMapControl({ center }) {
  const [radiusKm, setRadiusKm] = useState(5);
  const [status, setStatus] = useState('idle'); // idle | downloading | done | error
  const [progress, setProgress] = useState({ completed: 0, total: 0 });

  const handleDownload = async () => {
    setStatus('downloading');
    setProgress({ completed: 0, total: 0 });
    try {
      const [lat, lng] = center;
      const result = await downloadTilesForOfflineUse({ lat, lng, radiusKm }, (completed, total) =>
        setProgress({ completed, total })
      );
      setProgress({ completed: result.tilesDownloaded, total: result.totalTiles });
      setStatus('done');
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

  const percent = progress.total ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <div className="rounded-lg border border-console-border bg-console-surface p-4">
      <p className="font-mono text-xs uppercase tracking-wide text-console-muted">Offline map</p>
      <p className="mt-1 text-xs text-console-muted">
        Download the map around your current view now, so it still works if you lose signal later.
      </p>

      <div className="mt-3 flex items-center gap-2">
        {RADIUS_OPTIONS.map((r) => (
          <button
            key={r}
            onClick={() => setRadiusKm(r)}
            disabled={status === 'downloading'}
            className={`rounded border px-2.5 py-1 font-mono text-xs ${
              radiusKm === r
                ? 'border-brand bg-brand/10 text-brand'
                : 'border-console-border text-console-muted hover:text-console-mist'
            }`}
          >
            {r} km
          </button>
        ))}
      </div>

      <button
        onClick={handleDownload}
        disabled={status === 'downloading'}
        className="mt-3 w-full rounded-md bg-brand py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {status === 'downloading' ? `Downloading… ${percent}%` : 'Download for offline use'}
      </button>

      {status === 'downloading' && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-console-bg">
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${percent}%` }} />
        </div>
      )}
      {status === 'done' && (
        <p className="mt-2 text-xs text-severity-low">
          ✓ {progress.total} map tiles saved — available even without signal.
        </p>
      )}
      {status === 'error' && (
        <p className="mt-2 text-xs text-severity-critical">
          Couldn't download the map. Your browser may not support offline storage.
        </p>
      )}
    </div>
  );
}
