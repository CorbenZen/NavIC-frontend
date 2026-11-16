// An empty base means the API is served from this page's origin. This is the
// normal local-proxy and FastAPI-mounted production setup; deployments that
// host the API on another origin can still set VITE_API_BASE_URL at build time.
const configured = import.meta.env.VITE_API_BASE_URL || '';
export const API_BASE = configured.replace(/\/$/, '');
export const FRONTEND_ENV = (import.meta.env.VITE_APP_ENV || (import.meta.env.DEV ? 'development' : 'production')).toLowerCase();
export const IS_DEVELOPMENT = FRONTEND_ENV === 'development';
export const API_CONFIGURED = true;
export const CSRF_COOKIE = 'navic_csrf';
let sessionCsrfToken = null;

export class ApiError extends Error {
  constructor(message, { status = null, body = null, url = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.url = url;
  }
}

export function getCookie(name) {
  if (typeof document === 'undefined') return null;
  const prefix = `${name}=`;
  const match = document.cookie.split('; ').find((entry) => entry.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}

const PUBLIC_WRITE_PATHS = new Set([
  '/auth/login',
  '/auth/admin-login',
  '/auth/magic-link',
  '/auth/magic-link/verify',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/verify-email',
  '/api/auth/resend-verification',
]);

async function getSessionCsrfToken() {
  const cookieToken = getCookie(CSRF_COOKIE);
  if (cookieToken) return cookieToken;
  if (sessionCsrfToken) return sessionCsrfToken;
  if (!API_CONFIGURED) return null;
  try {
    const response = await fetch(`${API_BASE}/auth/csrf`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    });
    if (!response.ok) return null;
    const result = await response.json();
    sessionCsrfToken = typeof result.csrf_token === 'string' ? result.csrf_token : null;
    return sessionCsrfToken;
  } catch {
    return null;
  }
}

async function refreshCsrfToken() {
  sessionCsrfToken = null;
  const cookieToken = getCookie(CSRF_COOKIE);
  if (cookieToken) return cookieToken;
  if (!API_CONFIGURED) return null;
  try {
    const response = await fetch(`${API_BASE}/auth/csrf`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    });
    if (!response.ok) return null;
    const result = await response.json();
    sessionCsrfToken = typeof result.csrf_token === 'string' ? result.csrf_token : null;
    return sessionCsrfToken;
  } catch {
    return null;
  }
}

function validationMessage(detail) {
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        const field = Array.isArray(item.loc) ? item.loc.filter((x) => x !== 'body' && x !== 'query').join('.') : 'field';
        return `${field || 'field'}: ${item.msg || 'invalid value'}`;
      })
      .join('; ');
  }
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail === 'object') return JSON.stringify(detail);
  return null;
}

export async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');
  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;
  let body = options.body;
  if (body !== undefined && body !== null && !isForm && typeof body !== 'string') {
    body = JSON.stringify(body);
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  } else if (typeof body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = getCookie(CSRF_COOKIE) || sessionCsrfToken || (
      PUBLIC_WRITE_PATHS.has(path.split('?')[0]) ? null : await getSessionCsrfToken()
    );
    if (csrf) headers.set('X-CSRF-Token', csrf);
  }

  let response;
  try {
    response = await fetch(url, { ...options, method, body, headers, credentials: 'include' });
  } catch (error) {
    throw new ApiError(`Cannot reach the CBTMS backend${API_BASE ? ` at ${API_BASE}` : ''}. Check the API service and retry.`, {
      url,
      cause: error,
    });
  }
  if (response.status === 204 || response.status === 205) return null;
  const raw = await response.text();
  const contentType = response.headers.get('content-type') || '';
  let result = raw;
  if (raw && (/application\/(?:[\w.+-]*\+)?json/i.test(contentType) || /^\s*[\[{]/.test(raw))) {
    try {
      result = JSON.parse(raw);
    } catch {
      result = raw;
    }
  } else if (!raw) {
    result = null;
  }
  if (result && typeof result === 'object' && typeof result.csrf_token === 'string') {
    sessionCsrfToken = result.csrf_token;
  }
  if (method === 'POST' && path === '/api/auth/logout' && response.ok) {
    sessionCsrfToken = null;
  }
  if (!response.ok) {
    const detail =
      result && typeof result === 'object'
        ? validationMessage(result.detail) || validationMessage(result.error?.message) || validationMessage(result.error)
        : null;
    let message = detail || (typeof result === 'string' && result.trim() ? result.trim().slice(0, 400) : `Request failed with HTTP ${response.status}`);
    if (response.status === 401) message = detail || 'Authentication required. Sign in with an authorised account.';
    if (response.status === 403) {
      // Check if this is a CSRF error that we can retry
      const isCsrfError = detail &&
        (detail.includes('CSRF token') || detail.includes('csrf'));
      if (isCsrfError) {
        // Try to refresh the CSRF token and retry once
        const newCsrf = await refreshCsrfToken();
        if (newCsrf) {
          const retryHeaders = new Headers(headers);
          retryHeaders.set('X-CSRF-Token', newCsrf);
          try {
            const retryResponse = await fetch(url, { ...options, method, body, headers: retryHeaders, credentials: 'include' });
            if (retryResponse.ok) {
              const rawRetry = await retryResponse.text();
              const contentTypeRetry = retryResponse.headers.get('content-type') || '';
              let resultRetry = rawRetry;
              if (rawRetry && (/application\/(?:[\w.+-]*\+)?json/i.test(contentTypeRetry) || /^\s*[\[{]/.test(rawRetry))) {
                try {
                  resultRetry = JSON.parse(rawRetry);
                } catch {
                  resultRetry = rawRetry;
                }
              }
              if (resultRetry && typeof resultRetry === 'object' && typeof resultRetry.csrf_token === 'string') {
                sessionCsrfToken = resultRetry.csrf_token;
              }
              if (method === 'POST' && path === '/api/auth/logout' && retryResponse.ok) {
                sessionCsrfToken = null;
              }
              if (!retryResponse.ok) {
                const detailRetry =
                  resultRetry && typeof resultRetry === 'object'
                    ? validationMessage(resultRetry.detail) || validationMessage(resultRetry.error?.message) || validationMessage(resultRetry.error)
                    : null;
                let messageRetry = detailRetry || (typeof resultRetry === 'string' && resultRetry.trim() ? resultRetry.trim().slice(0, 400) : `Request failed with HTTP ${retryResponse.status}`);
                if (retryResponse.status === 401) messageRetry = detailRetry || 'Authentication required. Sign in with an authorised account.';
                if (retryResponse.status === 403) messageRetry = detailRetry || 'Your account is not permitted to perform this action.';
                if (retryResponse.status === 404) messageRetry = detailRetry || 'The requested record or endpoint was not found.';
                if (retryResponse.status === 405) messageRetry = detailRetry || 'Request method is not allowed for this endpoint (HTTP 405).';
                if (retryResponse.status === 429) messageRetry = detailRetry || 'Too many requests. Wait a moment and retry.';
                if (retryResponse.status >= 500) messageRetry = detailRetry || `Backend error (HTTP ${retryResponse.status}). Check the server logs.`;
                const isAuthRetry = path.startsWith('/auth/') || path.startsWith('/api/auth/');
                if (retryResponse.status === 401 && !isAuthRetry) {
                  window.dispatchEvent(new CustomEvent('navic:unauthorized'));
                }
                throw new ApiError(messageRetry, { status: retryResponse.status, body: resultRetry, url });
              }
              // Retry succeeded
              return resultRetry;
            }
          } catch (_) {
            // Retry failed with network error, fall through to original error
          }
        }
        message = detail || 'Your session has expired. Sign in again.';
      }
    }
    if (response.status === 403 && !detail) message = 'Your account is not permitted to perform this action.';
    if (response.status === 404) message = detail || 'The requested record or endpoint was not found.';
    if (response.status === 405) message = detail || 'Request method is not allowed for this endpoint (HTTP 405).';
    if (response.status === 429) message = detail || 'Too many requests. Wait a moment and retry.';
    if (response.status >= 500) message = detail || `Backend error (HTTP ${response.status}). Check the server logs.`;
    const isAuthenticationRequest = path.startsWith('/auth/') || path.startsWith('/api/auth/');
    if (response.status === 401 && !isAuthenticationRequest) {
      window.dispatchEvent(new CustomEvent('navic:unauthorized'));
    }
    throw new ApiError(message, { status: response.status, body: result, url });
  }
  return result;
}

export function locationSocketUrl() {
  if (!API_CONFIGURED) return null;
  const base = API_BASE ? new URL(API_BASE, window.location.href) : new URL(window.location.href);
  const protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${base.host}/ws/locations`;
}

export function googleLoginUrl() {
  return API_CONFIGURED ? `${API_BASE}/auth/google/login` : null;
}

export const api = {
  meta: () => apiFetch('/api/meta'),
  me: () => apiFetch('/auth/me'),
  userProfile: () => apiFetch('/api/user/me'),
  updateUserProfile: (data) => apiFetch('/api/user/profile', { method: 'PUT', body: data }),
  userPreferences: () => apiFetch('/api/users/me/preferences'),
  saveUserPreferences: (data) => apiFetch('/api/users/me/preferences', { method: 'PUT', body: data }),
  submitFeedback: (data) => apiFetch('/api/feedback', { method: 'POST', body: data }),
  submitSupport: (data) => apiFetch('/api/support', { method: 'POST', body: data }),
  supportInfo: () => apiFetch('/api/support/info'),
  terms: () => apiFetch('/api/user/terms'),
  busPass: () => apiFetch('/api/user/bus-pass'),
  verifyBusPass: (token) => apiFetch(`/api/bus-pass/verify/${encodeURIComponent(token)}`),
  requestMagicLink: (email) => apiFetch('/auth/magic-link', { method: 'POST', body: { email } }),
  verifyMagicLink: (token) => apiFetch('/auth/magic-link/verify', { method: 'POST', body: { token } }),
  login: (email, password) => apiFetch('/auth/login', { method: 'POST', body: { email, password } }),
  loginWithId: (userId, password) => apiFetch('/api/auth/login', { method: 'POST', body: { user_id: userId, password } }),
  registerAccount: (details) => apiFetch('/api/auth/register', { method: 'POST', body: details }),
  register: (details) => apiFetch('/api/auth/register', { method: 'POST', body: details }),
  verifyEmail: (token) => apiFetch('/api/auth/verify-email', { method: 'POST', body: { token } }),
  resendVerification: (email) => apiFetch('/api/auth/resend-verification', { method: 'POST', body: { email } }),
  verificationStatus: () => apiFetch('/api/auth/verification-status'),
  authMe: () => apiFetch('/api/auth/me'),
  logout: () => apiFetch('/api/auth/logout', { method: 'POST' }),
  adminLogin: (email, password) => apiFetch('/auth/admin-login', { method: 'POST', body: { email, password } }),
  googleLoginUrl,
  summary: () => apiFetch('/api/dashboard/summary'),
  // The Dashboard's admin-only attention and hygiene panels use this separate,
  // count-only endpoint so they do not derive privileged data from fleet lists.
  adminDashboardSummary: () => apiFetch('/api/dashboard/admin-summary'),
  stats: () => apiFetch('/api/dashboard/stats'),
  vehicles: () => apiFetch('/buses'),
  vehicle: (id) => apiFetch(`/buses/${id}`),
  createVehicle: (data) => apiFetch('/buses', { method: 'POST', body: data }),
  updateVehicle: (id, data) => apiFetch(`/buses/${id}`, { method: 'PUT', body: data }),
  deleteVehicle: (id) => apiFetch(`/buses/${id}`, { method: 'DELETE' }),
  history: (busId, params = '') => apiFetch(`/buses/${busId}/history${params}`),
  tracking: () => apiFetch('/api/tracking/latest'),
  drivers: () => apiFetch('/drivers'),
  createDriver: (data) => apiFetch('/drivers', { method: 'POST', body: data }),
  updateDriver: (id, data) => apiFetch(`/drivers/${id}`, { method: 'PUT', body: data }),
  deleteDriver: (id) => apiFetch(`/drivers/${id}`, { method: 'DELETE' }),
  routes: () => apiFetch('/routes'),
  createRoute: (data) => apiFetch('/routes', { method: 'POST', body: data }),
  updateRoute: (id, data) => apiFetch(`/routes/${id}`, { method: 'PUT', body: data }),
  deleteRoute: (id) => apiFetch(`/routes/${id}`, { method: 'DELETE' }),
  devices: () => apiFetch('/devices'),
  createDevice: (data) => apiFetch('/devices', { method: 'POST', body: data }),
  updateDevice: (id, data) => apiFetch(`/devices/${id}`, { method: 'PUT', body: data }),
  deleteDevice: (id) => apiFetch(`/devices/${id}`, { method: 'DELETE' }),
  deviceTelemetry: (deviceId) => apiFetch(`/api/devices/${encodeURIComponent(deviceId)}/telemetry/latest`),
  getObservedConstellations: (deviceId, limit = 200) => apiFetch(`/api/devices/${encodeURIComponent(deviceId)}/telemetry/observed-constellations?limit=${limit}`),
  // Geofences
  geofences: () => apiFetch('/geofences'),
  createGeofence: (data) => apiFetch('/geofences', { method: 'POST', body: data }),
  updateGeofence: (id, data) => apiFetch(`/geofences/${id}`, { method: 'PUT', body: data }),
  deleteGeofence: (id) => apiFetch(`/geofences/${id}`, { method: 'DELETE' }),
  getGeofenceIncidents: (params = '') => apiFetch(`/api/geofences/incidents${params}`),
  markGeofenceIncidentRead: (id) => apiFetch(`/api/geofences/incidents/${id}/read`, { method: 'PATCH' }),
  markAllGeofenceIncidentsRead: () => apiFetch('/api/geofences/incidents/read-all', { method: 'PATCH' }),
  // Share tokens
  createShareToken: (busId, data) => apiFetch(`/api/buses/${busId}/share`, { method: 'POST', body: data }),
  listShareTokens: (busId) => apiFetch(`/api/buses/${busId}/share`),
  revokeShareToken: (busId, tokenId) => apiFetch(`/api/buses/${busId}/share/${tokenId}`, { method: 'DELETE' }),
  // Public share API (no auth required)
  getPublicBus: (token) => apiFetch(`/public/bus/${encodeURIComponent(token)}`),
  getPublicBusStatus: (token) => apiFetch(`/public/api/bus/${encodeURIComponent(token)}/status`),
  reports: (type, params) => apiFetch(`/api/reports/${type}?${params}`),
  // Demo simulation (admin only)
  startDemoSimulation: (speedMultiplier = 1) => apiFetch('/api/admin/demo/simulation/start', { method: 'POST', body: { speed_multiplier: speedMultiplier } }),
  stopDemoSimulation: () => apiFetch('/api/admin/demo/simulation/stop', { method: 'POST' }),
  getDemoSimulationState: () => apiFetch('/api/admin/demo/simulation/state'),
  reportCsv: (type, params) => apiFetch(`/api/reports.csv?report_type=${encodeURIComponent(type)}&${params}`),
  alerts: (params = '') => apiFetch(`/alerts${params}`),
  markAlertRead: (id) => apiFetch(`/alerts/${id}`, { method: 'PATCH' }),
  markAllAlertsRead: () => apiFetch('/alerts/read-all', { method: 'PATCH' }),
  settings: () => apiFetch('/settings'),
  saveSettings: (data) => apiFetch('/settings', { method: 'PUT', body: data }),
  health: () => apiFetch('/health'),
  audit: (params = '') => apiFetch(`/api/audit${params}`),
};
