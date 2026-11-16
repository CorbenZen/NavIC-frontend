/*
 * Shared initials/photo avatar for drivers and signed-in users.
 * Names come from the existing driver or session user records; no placeholder identity is generated.
 */
import { cx } from './cx';

function initialsFor(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1) return `${parts[0][0]}${parts.at(-1)[0]}`.toUpperCase();
  return (parts[0] || 'U').slice(0, 2).toUpperCase();
}

export function Avatar({ name, src, className, onError, ...props }) {
  return src
    ? <img {...props} className={cx('avatar', 'user-avatar-image', className)} src={src} alt="" referrerPolicy="no-referrer" onError={onError} />
    : <span {...props} className={cx('avatar', className)} role="img" aria-label={`${name || 'User'} initials`}>{initialsFor(name)}</span>;
}
