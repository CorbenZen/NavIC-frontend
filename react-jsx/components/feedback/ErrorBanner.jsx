/* Shared API error display; shell health state owns reachability messages. */
import { AlertCircle } from 'lucide-react';

export function ErrorBanner({ message, onRetry, retryLabel = 'Retry' }) {
  // The shell owns network reachability, so pages keep stale data without
  // repeating the same connection error in every route panel.
  if (typeof message === 'string' && message.startsWith('Cannot reach the CBTMS backend')) return null;
  if (!message) return null;
  return (
    <div className="error-banner" role="alert">
      <AlertCircle />
      <span>{message}</span>
      {onRetry ? (
        <button type="button" className="btn btn-sm" onClick={onRetry}>
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
