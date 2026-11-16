/* Shared API error display; shell health state owns reachability messages. */
import { AlertCircle } from 'lucide-react';

export function ErrorBanner({ message, onRetry, retryLabel = 'Retry', resource = 'data' }) {
  // The shell owns network reachability, so pages keep stale data without
  // repeating the same connection error in every route panel.
  const messageText = typeof message === 'string' ? message : message?.message;
  if (typeof messageText === 'string' && messageText.startsWith('Cannot reach the CBTMS backend')) return null;
  if (!message) return null;
  const isApiError = typeof message === 'object' && message !== null && Number.isInteger(message.status);
  const summary = isApiError && message.status >= 500
    ? `Couldn't load ${resource} (${message.status}).${message.referenceId ? ` Ref ${message.referenceId}.` : ''}`
    : isApiError ? message.message : message;
  return (
    <div className="error-banner" role="alert">
      <AlertCircle />
      <span>{summary}</span>
      {onRetry ? (
        <button type="button" className="btn btn-sm" onClick={onRetry}>
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
