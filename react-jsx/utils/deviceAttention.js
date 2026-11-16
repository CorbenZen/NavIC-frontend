/**
 * Shared source for the dashboard's device-attention panel and sidebar badge.
 * These two groups mirror the dashboard's existing no-session/stale selectors.
 */
export function selectDeviceAttention(devices = []) {
  const active = devices.filter((device) => device.active);
  const offline = active.filter((device) => !device.online);
  const stale = active.filter((device) => device.online && !device.telemetry_fresh);
  return { offline, stale, count: offline.length + stale.length };
}
