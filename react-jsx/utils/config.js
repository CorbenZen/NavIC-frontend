export const APP_NAME = 'NavIC';
export const APP_SUBTITLE = 'College Bus Tracking & Management';

export const REPORT_CATALOG = [
  {
    group: 'Trips',
    items: [
      { type: 'trip', label: 'Trip report', description: 'Trips split at gaps longer than 30 minutes.' },
      { type: 'trip-distance', label: 'Trip distance', description: 'Distance and duration per derived trip.' },
      { type: 'vehicle-trip-list', label: 'Vehicle trip list', description: 'Trip list with vehicle identifiers.' },
    ],
  },
  {
    group: 'Activity & utilisation',
    items: [
      { type: 'daily-activity', label: 'Daily activity', description: 'Fixes, active vehicles and distance per day.' },
      { type: 'vehicle-activity', label: 'Vehicle activity', description: 'Per-vehicle movement, distance and utilisation.' },
      { type: 'vehicle-utilization', label: 'Vehicle utilisation', description: 'Active days as a share of the selected period.' },
      { type: 'route-activity', label: 'Route activity', description: 'Telemetry grouped by the assigned route.' },
    ],
  },
  {
    group: 'Stops',
    items: [
      { type: 'stoppage', label: 'Stoppage report', description: 'Measured slow-speed periods with telemetry coverage.' },
      { type: 'idle', label: 'Idle report', description: 'Engine-on, not-moving periods. Requires ignition in telemetry.' },
      { type: 'overspeed', label: 'Overspeed report', description: 'Fixes above the configured speed threshold.' },
    ],
  },
  {
    group: 'Fleet & devices',
    items: [
      { type: 'current-fleet', label: 'Current fleet', description: 'Latest persisted position per device.' },
      { type: 'device-connectivity', label: 'Device connectivity', description: 'TCP session and telemetry freshness.' },
      { type: 'consolidated', label: 'Consolidated', description: 'Record, vehicle and simulation totals.' },
      { type: 'km', label: 'Distance summary', description: 'Total geodesic distance in the selection.' },
      { type: 'history', label: 'Raw history', description: 'Every persisted fix with GNSS fields.' },
    ],
  },
];

export const REPORT_NAMES = Object.fromEntries(REPORT_CATALOG.flatMap((group) => group.items.map((item) => [item.type, item.label])));

export const ALERT_META = {
  overspeed: { label: 'Overspeed', tone: 'danger' },
  device_offline: { label: 'Device offline', tone: 'warning' },
  geofence_entry: { label: 'Geofence entry', tone: 'info' },
  geofence_exit: { label: 'Geofence exit', tone: 'neutral' },
};
