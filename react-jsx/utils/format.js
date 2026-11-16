export function parseDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function fmtDateTime(value) {
  const date = parseDate(value);
  if (!date) return '—';
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function fmtTime(value) {
  const date = parseDate(value);
  if (!date) return '—';
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function fmtDate(value) {
  const date = parseDate(value);
  if (!date) return '—';
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function timeAgo(value) {
  const date = parseDate(value);
  if (!date) return 'Never';
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function fmtNumber(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function fmtSpeed(value) {
  if (value === null || value === undefined) return '—';
  return `${fmtNumber(value, 1)} km/h`;
}

export function fmtDistance(value) {
  if (value === null || value === undefined) return '—';
  return `${fmtNumber(value, 2)} km`;
}

export function fmtDuration(minutes) {
  if (minutes === null || minutes === undefined) return '—';
  const total = Math.round(Number(minutes));
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function toLocalInput(date) {
  const d = parseDate(date) || new Date();
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

export function initial(value) {
  return String(value || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

export const STATUS_META = {
  moving: { label: 'Moving', tone: 'success' },
  on_move: { label: 'On Move', tone: 'success' },
  stopped: { label: 'Stopped', tone: 'danger' },
  idle: { label: 'Idle', tone: 'warning' },
  offline: { label: 'Offline', tone: 'neutral' },
  no_data: { label: 'No data', tone: 'neutral' },
  out_of_network: { label: 'Out Of N/w', tone: 'neutral' },
  toing: { label: 'Toing', tone: 'violet' },
  unknown: { label: 'Unknown', tone: 'neutral' },
};

export const STATUS_COLORS = {
  all: 'var(--status-all)',
  on_move: 'var(--status-on-move)',
  stopped: 'var(--status-stopped)',
  idle: 'var(--status-idle)',
  out_of_network: 'var(--status-out-of-network)',
  toing: 'var(--status-toing)',
};

export function statusMeta(vehicle) {
  const key = vehicle?.status_key || String(vehicle?.status || '').toLowerCase().replace(/\s+/g, '_');
  return STATUS_META[key] || { label: vehicle?.status || 'Unknown', tone: 'neutral' };
}

export function hasPosition(point) {
  if (!point) return false;
  const latRaw = point.latitude;
  const lonRaw = point.longitude;
  if (latRaw === null || latRaw === undefined || latRaw === '' || lonRaw === null || lonRaw === undefined || lonRaw === '') {
    return false;
  }
  const latitude = Number(latRaw);
  const longitude = Number(lonRaw);
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}

export function haversineKm(a, b) {
  if (!hasPosition(a) || !hasPosition(b)) return 0;
  const toRad = (v) => (Number(v) * Math.PI) / 180;
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const dLat = lat2 - lat1;
  const dLon = toRad(Number(b.longitude) - Number(a.longitude));
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

export function pathDistanceKm(points = []) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += haversineKm(points[i - 1], points[i]);
  }
  return total;
}

export function csvEscape(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function downloadCsv(filename, rows) {
  if (!rows?.length) return;
  const columns = Object.keys(rows[0]);
  const csv = [columns.join(','), ...rows.map((row) => columns.map((col) => csvEscape(row[col])).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
}

export function titleCase(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function displayCell(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return fmtDateTime(text);
  return text;
}
