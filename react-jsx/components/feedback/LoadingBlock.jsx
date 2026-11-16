export function LoadingBlock({ label = 'Loading…' }) {
  return (
    <div className="loading-block" role="status" aria-live="polite">
      <span className="spinner" />
      {label}
    </div>
  );
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

export function InlineSpinner({ label = 'Working…' }) {
  return (
    <span className="row small muted" style={{ gap: 7 }}>
      <Spinner />
      {label}
    </span>
  );
}
