import { apiFetch } from '@services/api';

/**
 * Primary authentication service.
 *
 * Normal student and teacher accounts use a unique User ID plus password.  No
 * email address, SMTP configuration or verification link participates in this
 * flow.  The backend returns a database-backed session cookie on success.
 */
export const signIn = (userId, password) =>
  apiFetch('/api/auth/login', { method: 'POST', body: { user_id: userId, password } });

export const signUp = (details) =>
  apiFetch('/api/auth/register', { method: 'POST', body: details });

export const signOut = () => apiFetch('/api/auth/logout', { method: 'POST' });

export const currentUser = () => apiFetch('/api/auth/me');
