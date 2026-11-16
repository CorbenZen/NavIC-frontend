import L from 'leaflet';
import { STATUS_COLORS } from '@react/utils/format';

/** CSS suffix used by the marker, tooltip and popup classes. */
export function statusClassName(statusKey) {
  if (statusKey === 'on_move') return 'moving';
  if (statusKey === 'out_of_network') return 'offline';
  return String(statusKey || 'offline').replaceAll('_', '-');
}

/** Build a Leaflet div icon for one vehicle marker. */
export function fleetIcon(statusKey, selected, simulated, isStale = false, isAnimating = false) {
  const statusClass = statusClassName(statusKey);
  const markerColor = STATUS_COLORS[statusKey] || STATUS_COLORS.out_of_network;
  return L.divIcon({
    className: 'fleet-marker-wrap',
    html: `<span class="fleet-marker ${statusClass}${selected ? ' selected' : ''}${simulated ? ' simulated' : ''}${isStale ? ' stale' : ''}${isAnimating ? ' status-changing' : ''}" style="--marker-color:${markerColor}"><span></span></span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -14],
  });
}
