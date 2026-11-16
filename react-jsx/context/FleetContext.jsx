/*
 * Shared fleet and connectivity state for shell badges and route data. Fleet
 * rows arrive from REST snapshots and WebSocket events; reachability uses /health.
 */
import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@services/api';
import { createRealtimeSocket } from '@services/websocket';
import { useToast } from '../components/feedback';

export const FleetContext = createContext(null);

const REFRESH_INTERVAL_MS = 30000;

const DATA_SOURCES = ['all', 'hardware', 'simulator', 'test_replay'];
const DATA_SOURCE_STORAGE_KEY = 'navic-data-source';

function isDataSource(value) {
  return DATA_SOURCES.includes(value);
}

function readStoredDataSource() {
  if (typeof window === 'undefined') return 'all';
  try {
    const saved = new URLSearchParams(window.location.search).get('source');
    if (isDataSource(saved)) return saved;
    const stored = window.localStorage.getItem(DATA_SOURCE_STORAGE_KEY);
    if (isDataSource(stored)) return stored;
  } catch {
    // Storage can be unavailable (private mode, disabled cookies).
  }
  return 'all';
}

const EMPTY = {
  meta: null,
  user: null,
  summary: null,
  vehicleStats: null,
  adminDashboardSummary: null,
  tracking: [],
  vehicles: [],
  drivers: [],
  routes: [],
  devices: [],
  geofences: [],
  alerts: [],
  unreadAlerts: 0,
  settings: null,
  preferences: null,
  // Demo simulation state
  demoSimulation: null,
};

const STATUS_COUNT_KEYS = ['on_move', 'stopped', 'idle', 'out_of_network', 'toing'];
const STATUS_LABELS = { on_move: 'On Move', stopped: 'Stopped', idle: 'Idle', out_of_network: 'Out Of N/w', toing: 'Toing' };

function nextStatusCounts(counts, oldKey, newKey) {
  if (!counts || oldKey === newKey) return counts;
  const next = { ...counts };
  if (STATUS_COUNT_KEYS.includes(oldKey)) next[oldKey] = Math.max(0, Number(next[oldKey] || 0) - 1);
  if (STATUS_COUNT_KEYS.includes(newKey)) next[newKey] = Number(next[newKey] || 0) + 1;
  return next;
}

function isOlderTelemetry(message, previous) {
  if (!previous) return false;
  if (message.message_id && message.message_id === previous.latest?.message_id) return true;
  const incoming = Date.parse(message.timestamp || '');
  const current = Date.parse(previous.timestamp || '');
  return Number.isFinite(incoming) && Number.isFinite(current) && incoming < current;
}

function eventTime(row) {
  return Math.max(
    Date.parse(row?.timestamp || '') || 0,
    Date.parse(row?.last_seen || '') || 0,
    Date.parse(row?.received_at || '') || 0,
  );
}

function mergeLiveRows(serverRows, liveRows, key) {
  const byKey = new Map(liveRows.map((row) => [row[key], row]));
  const liveFields = ['status', 'status_key', 'status_reason', 'speed', 'latitude', 'longitude', 'ignition', 'ignition_available', 'timestamp', 'received_at', 'last_seen', 'last_seen_formatted', 'course', 'latest'];
  return serverRows.map((row) => {
    const live = byKey.get(row[key]);
    if (!live || eventTime(live) <= eventTime(row)) return row;
    const updated = { ...row };
    for (const field of liveFields) if (field in live) updated[field] = live[field];
    return updated;
  });
}

function reconcileCounts(counts, serverRows, mergedRows, key) {
  if (!counts) return counts;
  const serverByKey = new Map(serverRows.map((row) => [row[key], row]));
  let result = counts;
  for (const merged of mergedRows) {
    const server = serverByKey.get(merged[key]);
    if (server && eventTime(merged) > eventTime(server) && server.status_key !== merged.status_key) {
      result = nextStatusCounts(result, server.status_key, merged.status_key);
    }
  }
  return result;
}

function applyVehicleTelemetry(state, message) {
  const index = state.tracking.findIndex((row) => row.device_id === message.device_id);
  const previous = index >= 0 ? state.tracking[index] : null;
  if (isOlderTelemetry(message, previous)) return state;
  const key = STATUS_COUNT_KEYS.includes(message.status_key) ? message.status_key : previous?.status_key || 'out_of_network';
  const status = STATUS_LABELS[key];
  const timestamp = message.timestamp || previous?.timestamp || null;
  const lat = Number(message.latitude);
  const lon = Number(message.longitude);
  const hasLatLon = Number.isFinite(lat) && Number.isFinite(lon);
  const nextRow = {
    ...previous,
    bus_id: message.bus_id ?? previous?.bus_id,
    latitude: hasLatLon ? lat : previous?.latitude,
    longitude: hasLatLon ? lon : previous?.longitude,
    speed: message.speed ?? previous?.speed,
    course: message.course ?? previous?.course,
    ignition: message.ignition ?? previous?.ignition,
    ignition_available: message.ignition_available ?? previous?.ignition_available ?? message.ignition != null,
    timestamp,
    received_at: message.server_time || new Date().toISOString(),
    status,
    status_key: key,
    vehicle_id: message.vehicle_id ?? previous?.vehicle_id,
    registration_number: message.registration_number ?? previous?.registration_number,
    driver_name: message.driver_name ?? previous?.driver_name,
    driver_phone: message.driver_phone ?? previous?.driver_phone,
    driver_email: message.driver_email ?? previous?.driver_email,
    route_name: message.route_name ?? previous?.route_name,
    device_name: message.device_name ?? previous?.device_name,
    device_model: message.device_model ?? previous?.device_model,
    imei_no: message.imei_no ?? previous?.imei_no,
    latest: {
      ...(previous?.latest || {}),
      message_id: message.message_id ?? previous?.latest?.message_id,
      timestamp,
      received_at: message.server_time || new Date().toISOString(),
      latitude: hasLatLon ? lat : previous?.latest?.latitude,
      longitude: hasLatLon ? lon : previous?.latest?.longitude,
      speed: message.speed ?? previous?.latest?.speed,
      course: message.course ?? previous?.latest?.course,
      ignition: message.ignition ?? previous?.latest?.ignition,
      simulated: message.simulated ?? previous?.latest?.simulated,
      gnss: message.gnss ?? previous?.latest?.gnss,
    },
  };
  const tracking = index < 0 ? state.tracking : [...state.tracking];
  if (index >= 0) tracking[index] = nextRow;

  const vehicleIndex = state.vehicles.findIndex((row) => row.id === message.bus_id || row.device_id === message.device_id);
  let vehicles = state.vehicles;
  let oldKey = previous?.status_key;
  if (vehicleIndex >= 0) {
    vehicles = [...state.vehicles];
    const existing = state.vehicles[vehicleIndex];
    oldKey ||= existing.status_key;
    vehicles[vehicleIndex] = {
      ...existing,
      ...nextRow,
      id: existing.id,
      status,
      status_key: key,
      last_seen: timestamp,
      last_seen_formatted: timestamp,
      latitude: nextRow.latitude,
      longitude: nextRow.longitude,
    };
  }

  const vehicleStats = nextStatusCounts(state.vehicleStats, oldKey, key);
  let summary = state.summary;
  if (summary) {
    const oldFleet = summary.fleet || {};
    const fleet = { ...oldFleet };
    if (oldKey && oldKey !== key) {
      if (oldKey === 'on_move') fleet.moving = Math.max(0, (fleet.moving || 0) - 1);
      else if (oldKey === 'out_of_network') {
        const bucket = previous?.timestamp ? 'offline' : 'no_data';
        fleet[bucket] = Math.max(0, (fleet[bucket] || 0) - 1);
      }
      else fleet[oldKey] = Math.max(0, (fleet[oldKey] || 0) - 1);
    }
    if (oldKey !== key) {
      if (key === 'on_move') fleet.moving = (fleet.moving || 0) + 1;
      else if (key === 'out_of_network') fleet.offline = (fleet.offline || 0) + 1;
      else fleet[key] = (fleet[key] || 0) + 1;
    }
    fleet.on_move = fleet.moving || 0;
    const recent = (summary.recent || []).map((row) => row.bus_id === message.bus_id ? {
      ...row, status, status_key: key, last_seen: timestamp,
      speed: nextRow.speed, latitude: nextRow.latitude, longitude: nextRow.longitude,
    } : row);
    summary = { ...summary, fleet, recent };
  }
  return { ...state, tracking, vehicles, vehicleStats, summary, lastEventAt: Date.now() };
}

export function FleetProvider({ enabled = true, user = null, children }) {
  const toast = useToast();
  const [dataSource, setDataSourceState] = useState(readStoredDataSource);
  const [apiStatus, setApiStatus] = useState('checking');
  const [apiUrl, setApiUrl] = useState(() => typeof window === 'undefined' ? '/health' : `${window.location.origin}/health`);
  const [apiCheckedAt, setApiCheckedAt] = useState(null);
  const [healthRetry, setHealthRetry] = useState(0);
  const [state, setState] = useState({ ...EMPTY, user, loading: true, refreshing: false, error: '', wsState: enabled ? 'connecting' : 'offline', lastUpdated: null });
  const aliveRef = useRef(true);
  const retryBackend = useCallback(() => setHealthRetry((value) => value + 1), []);

  // This single lightweight probe drives every shell connection indicator.
  // A timer is used instead of polling while hidden, and failures back off to
  // one minute so a stopped backend does not generate unnecessary traffic.
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    let stopped = false;
    let timer;
    let failureCount = 0;
    let controller;
    const schedule = (delay) => {
      window.clearTimeout(timer);
      if (!document.hidden) timer = window.setTimeout(check, delay);
    };
    const check = async () => {
      if (stopped || document.hidden) return;
      controller?.abort();
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 4000);
      try {
        const response = await fetch('/health', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        failureCount = 0;
        setApiStatus('online');
        setApiCheckedAt(Date.now());
        setApiUrl(`${window.location.origin}/health`);
        schedule(15000);
      } catch {
        failureCount += 1;
        setApiStatus('offline');
        setApiCheckedAt(Date.now());
        setApiUrl(`${window.location.origin}/health`);
        schedule(Math.min(15000 * (2 ** Math.min(failureCount - 1, 2)), 60000));
      } finally {
        window.clearTimeout(timeout);
      }
    };
    const onVisibility = () => {
      if (document.hidden) window.clearTimeout(timer);
      else check();
    };
    document.addEventListener('visibilitychange', onVisibility);
    check();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      controller?.abort();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, healthRetry]);
  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!enabled) return;
      if (!silent) setState((current) => ({ ...current, loading: !current.lastUpdated, error: '' }));
      setState((current) => ({ ...current, refreshing: true }));

      // Deferring each call into a promise also catches synchronous client
      // mistakes (such as a missing API method), so loading always settles.
      const requests = [
        () => api.summary(),
        () => api.tracking(),
        () => api.vehicles(),
        () => api.drivers(),
        () => api.routes(),
        () => api.devices(),
        () => api.alerts('?limit=40'),
        () => api.settings(),
        () => api.userPreferences(),
        () => api.stats(),
        () => api.geofences(),
        () => user?.role === 'admin' ? api.adminDashboardSummary() : null,
      ];
      const results = await Promise.allSettled(requests.map((request) => Promise.resolve().then(request)));

      if (!aliveRef.current) return;

      const [summary, tracking, vehicles, drivers, routes, devices, alerts, settings, preferences, vehicleStats, geofences, adminDashboardSummary] = results;
      const next = {};
      if (summary.status === 'fulfilled') next.summary = summary.value;
      if (vehicleStats.status === 'fulfilled') next.vehicleStats = vehicleStats.value;
      if (tracking.status === 'fulfilled') next.tracking = Array.isArray(tracking.value?.vehicles) ? tracking.value.vehicles : [];
      if (vehicles.status === 'fulfilled') next.vehicles = Array.isArray(vehicles.value) ? vehicles.value : [];
      if (drivers.status === 'fulfilled') next.drivers = Array.isArray(drivers.value) ? drivers.value : [];
      if (routes.status === 'fulfilled') next.routes = Array.isArray(routes.value) ? routes.value : [];
      if (devices.status === 'fulfilled') next.devices = Array.isArray(devices.value?.devices) ? devices.value.devices : [];
      if (geofences.status === 'fulfilled') next.geofences = Array.isArray(geofences.value) ? geofences.value : [];
      if (alerts.status === 'fulfilled') {
        next.alerts = Array.isArray(alerts.value?.alerts) ? alerts.value.alerts : [];
        next.unreadAlerts = Number(alerts.value?.unread_count || 0);
      }
      if (settings.status === 'fulfilled') next.settings = settings.value;
      if (preferences.status === 'fulfilled') {
        next.preferences = preferences.value;
      }
      // Keep admin-only diagnostic counts out of normal users' network requests and state.
      if (user?.role === 'admin' && adminDashboardSummary.status === 'fulfilled') {
        next.adminDashboardSummary = adminDashboardSummary.value;
      } else if (user?.role !== 'admin') {
        next.adminDashboardSummary = null;
      }

      const coreFailure = results.slice(0, 6).find((result) => result.status === 'rejected');
      setState((current) => {
        const tracking = next.tracking ? mergeLiveRows(next.tracking, current.tracking, 'device_id') : current.tracking;
        const vehicles = next.vehicles ? mergeLiveRows(next.vehicles, current.vehicles, 'id') : current.vehicles;
        let summary = next.summary || current.summary;
        if (next.summary && next.tracking) {
          const apiTrack = next.tracking;
          const mergedTrack = mergeLiveRows(apiTrack, current.tracking, 'device_id');
          const adjustedFleet = reconcileCounts(next.summary.fleet, apiTrack, mergedTrack, 'device_id');
          if (adjustedFleet !== next.summary.fleet) summary = { ...next.summary, fleet: adjustedFleet };
        }
        const vehicleStats = next.vehicleStats && next.vehicles
          ? reconcileCounts(next.vehicleStats, next.vehicles, vehicles, 'id')
          : next.vehicleStats || current.vehicleStats;
        return {
          ...current,
          ...next,
          tracking,
          vehicles,
          summary,
          vehicleStats,
          loading: false,
          refreshing: false,
          lastUpdated: coreFailure ? current.lastUpdated : Date.now(),
          // Connectivity failures belong to the shell's shared offline banner;
          // retain already-loaded rows and reserve page errors for HTTP errors.
          error: coreFailure?.reason?.status ? coreFailure.reason : '',
        };
      });
    },
    [enabled, user?.role],
  );

  const wasApiOnline = useRef(false);
  useEffect(() => {
    if (apiStatus === 'online' && wasApiOnline.current) load({ silent: true });
    wasApiOnline.current = apiStatus === 'online';
  }, [apiStatus, load]);

  useEffect(() => {
    aliveRef.current = true;
    if (!enabled) return undefined;
    const request = requestAnimationFrame(() => load());
    const timer = window.setInterval(() => load({ silent: true }), REFRESH_INTERVAL_MS);
    return () => {
      aliveRef.current = false;
      cancelAnimationFrame(request);
      window.clearInterval(timer);
    };
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled) {
      const frame = requestAnimationFrame(() => setState((current) => ({ ...current, wsState: 'offline' })));
      return () => cancelAnimationFrame(frame);
    }

    const handleMessage = (message) => {
      if (!message || typeof message !== 'object') return;

      if (message.type === 'vehicle_status' && typeof message.device_id === 'string') {
        setState((current) => applyVehicleTelemetry(current, message));
        return;
      }

      if (message.type !== 'location' || typeof message.device_id !== 'string') return;
      if (!Number.isFinite(Number(message.latitude)) || !Number.isFinite(Number(message.longitude))) return;
      setState((current) => applyVehicleTelemetry(current, message));
    };

    const socket = createRealtimeSocket({
      onStatus: (status) => setState((current) => ({ ...current, wsState: status })),
      onOpen: () => load({ silent: true }),
      onMessage: handleMessage,
    });

    return () => socket.close();
  }, [enabled, user?.role, toast, load]);

  // Single data-source setter: state, URL and localStorage stay in sync so a
  // reload or a shared link opens the same filtered view.
  const setDataSource = useCallback((source) => {
    if (!isDataSource(source)) return;
    setDataSourceState(source);
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      if (source === 'all') url.searchParams.delete('source');
      else url.searchParams.set('source', source);
      window.history.replaceState({}, '', url.toString());
      window.localStorage.setItem(DATA_SOURCE_STORAGE_KEY, source);
    } catch {
      // A blocked storage/history API must not break filtering.
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onPopState = () => setDataSourceState(readStoredDataSource());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Load demo simulation state (admin only)
  const loadDemoSimulationState = useCallback(async () => {
    if (typeof window === 'undefined') return;
    try {
      const response = await api.getDemoSimulationState();
      setState((current) => ({ ...current, demoSimulation: response }));
    } catch (err) {
      // Demo simulation not available or not authorized
      setState((current) => ({ ...current, demoSimulation: { running: false } }));
    }
  }, []);

  // Load demo simulation state on mount and when user role changes
  useEffect(() => {
    if (user?.role === 'admin') {
      const interval = setInterval(loadDemoSimulationState, 3000);
      // Defer initial load to avoid synchronous setState in effect
      const timeoutId = setTimeout(loadDemoSimulationState, 0);
      return () => {
        clearInterval(interval);
        clearTimeout(timeoutId);
      };
    }
  }, [user?.role, loadDemoSimulationState]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onPopState = () => setDataSourceState(readStoredDataSource());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      apiStatus,
      apiUrl,
      apiCheckedAt,
      retryBackend,
      user,
      dataSource,
      dataSources: DATA_SOURCES,
      setDataSource,
      // Kept for callers written against the earlier API.
      setDataSourceAsync: setDataSource,
      refresh: () => load({ silent: true }),
      reload: () => load({ silent: false }),
      setMeta: (meta) => setState((current) => ({ ...current, meta })),
    }),
    [state, user, load, dataSource, setDataSource, apiStatus, apiUrl, apiCheckedAt, retryBackend],
  );

  return <FleetContext.Provider value={value}>{children}</FleetContext.Provider>;
}
