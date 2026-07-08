// -----------------------------------------------------------------------------
// SeverityBadge.jsx — a small pulsing "beacon" + label, used everywhere an
// incident's severity is shown. This is CrisisGrid's one recurring visual
// signature: every severity reads as a live status light, like a real
// dispatch console, rather than a flat colored chip.
// -----------------------------------------------------------------------------

const SEVERITY_STYLES = {
  critical: { dot: 'bg-severity-critical', text: 'text-severity-critical', label: 'Critical' },
  high: { dot: 'bg-severity-high', text: 'text-severity-high', label: 'High' },
  medium: { dot: 'bg-severity-medium', text: 'text-severity-medium', label: 'Medium' },
  low: { dot: 'bg-severity-low', text: 'text-severity-low', label: 'Low' },
};

export default function SeverityBadge({ severity = 'medium', pulse = true }) {
  const style = SEVERITY_STYLES[severity] || SEVERITY_STYLES.medium;

  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wide ${style.text}`}>
      <span className="relative flex h-2 w-2">
        {pulse && (
          <span className={`absolute inline-flex h-full w-full rounded-full ${style.dot} animate-pulseBeacon`} />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${style.dot}`} />
      </span>
      {style.label}
    </span>
  );
}
