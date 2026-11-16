/* Shared status and metadata badge primitives; callers provide labels and tone from real app state. */
import { cx } from './cx';

const BADGE_TONES = {
  success: 'badge-success',
  danger: 'badge-danger',
  warning: 'badge-warning',
  info: 'badge-info',
  neutral: 'badge-neutral',
  violet: 'badge-violet',
};

export function Badge({ tone = 'neutral', dot = false, children, className }) {
  return (
    <span className={cx('badge', BADGE_TONES[tone] || BADGE_TONES.neutral, className)}>
      {dot ? <i className="dot" /> : null}
      {children}
    </span>
  );
}

export function StatusBadge({ status, statusKey }) {
  const key = (statusKey || String(status || '').toLowerCase().replace(/\s+/g, '_')).replaceAll('_', '-');
  return (
    <span className={`badge vehicle-status-badge status-${key}`}><i className="dot" />{status || 'Unknown'}</span>
  );
}
