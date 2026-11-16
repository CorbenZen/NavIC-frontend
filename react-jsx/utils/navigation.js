import {
  Activity,
  Bell,
  BusFront,
  Cpu,
  FileBarChart,
  History,
  LayoutDashboard,
  MapPin,
  RadioTower,
  Route,
  Settings,
  UserRound,
} from 'lucide-react';

export const NAV_GROUPS = [
  {
    key: 'operations',
    label: 'Operations',
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard, title: 'Dashboard', subtitle: 'Live operational picture from persisted telemetry' },
      { path: '/tracking', label: 'Live tracking', icon: RadioTower, title: 'Live tracking', subtitle: 'Positions, status and recorded history', flush: true },
      { path: '/trips', label: 'Trip history', icon: History, title: 'Trip history', subtitle: 'Trips derived from recorded fixes' },
    ],
  },
  {
    key: 'fleet',
    label: 'Fleet management',
    items: [
      { path: '/vehicles', label: 'Vehicles', icon: BusFront, title: 'Vehicles', subtitle: 'Buses and their driver, route and device assignments' },
      { path: '/drivers', label: 'Drivers', icon: UserRound, title: 'Drivers', subtitle: 'Driver records and vehicle assignments' },
      { path: '/routes', label: 'Routes', icon: Route, title: 'Routes', subtitle: 'Configured stop sequences and route assignments' },
      { path: '/geofences', label: 'Geofences', icon: MapPin, title: 'Geofences', subtitle: 'Circular fences with entry/exit incidents and hysteresis' },
      { path: '/devices', label: 'Devices', icon: Cpu, title: 'Tracking devices', subtitle: 'IVTD registry, assignments and telemetry health' },
    ],
  },
  {
    key: 'insights',
    label: 'Insights',
    items: [
      { path: '/reports', label: 'Reports', icon: FileBarChart, title: 'Reports', subtitle: 'Downloadable reports computed from stored telemetry' },
      { path: '/diagnostics', label: 'GNSS diagnostics', icon: Activity, title: 'GNSS diagnostics', subtitle: 'Receiver-reported values and capability caveats' },
      { path: '/alerts', label: 'Alerts', icon: Bell, title: 'Alerts', subtitle: 'Overspeed, connectivity and geofence events' },
    ],
  },
  {
    key: 'system',
    label: 'System',
    items: [{ path: '/settings', label: 'Settings', icon: Settings, title: 'Settings', subtitle: 'Operational thresholds, account and audit trail' }],
  },
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

export const MANAGEMENT_ROLES = new Set(['admin', 'transport', 'transport_department', 'manager']);
const MANAGEMENT_PATHS = new Set(['/vehicles', '/drivers', '/routes', '/geofences', '/devices', '/settings']);

export function isManagementRole(role) {
  return MANAGEMENT_ROLES.has(String(role || '').toLowerCase());
}

export function navGroupsForRole(role) {
  if (String(role || '').toLowerCase() === 'admin') return NAV_GROUPS;
  if (isManagementRole(role)) return NAV_GROUPS;
  return NAV_GROUPS.filter((group) => group.label === 'Operations' || group.label === 'Insights');
}

export function canAccessPath(path, role) {
  if (isManagementRole(role)) return true;
  return !MANAGEMENT_PATHS.has(path);
}

export function routeMeta(path) {
  return NAV_ITEMS.find((item) => item.path === path) || NAV_ITEMS[0];
}

export function routeBreadcrumbs(path) {
  const segments = path.split('/').filter(Boolean);
  const crumbs = [{ path: '/', label: 'Dashboard' }];
  let currentPath = '';
  for (const seg of segments) {
    currentPath += `/${seg}`;
    const item = NAV_ITEMS.find((item) => item.path === currentPath);
    if (item) {
      crumbs.push({ path: currentPath, label: item.label });
    }
  }
  return crumbs;
}
