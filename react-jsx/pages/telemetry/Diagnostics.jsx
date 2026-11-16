import {
  Activity,
  Cpu,
  Database,
  RefreshCw,
  Satellite,
  Server,
  ShieldCheck,
  Wifi,
  WifiOff,
  Clock,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@services/api';
import { Badge, Card, EmptyState, PageHeader, StatusBadge } from '../../components/common';
import { DATA_SOURCE_LABELS, rowDataSource, SearchInput } from '../../components/forms';
import { ErrorBanner, InfoBanner, LoadingBlock } from '../../components/feedback';
import { useFleet } from '@react/hooks/useFleet';
import { fmtDateTime, fmtNumber, fmtSpeed } from '@react/utils/format';

const CONSTELLATIONS = ['navic', 'gps', 'glonass', 'galileo', 'beidou', 'qzss'];
const CONSTELLATION_NAMES = { navic: 'NavIC', gps: 'GPS', glonass: 'GLONASS', galileo: 'Galileo', beidou: 'BeiDou', qzss: 'QZSS' };

function compatibilityLabel(value) {
  if (value === 'supported_detected') return 'Supported and detected';
  if (value === 'supported_not_detected') return 'Supported, not detected';
  if (value === 'unsupported') return 'Unsupported';
  return 'Unsupported or unverified';
}

export function Diagnostics() {
  const { devices, loading, error, refresh, refreshing } = useFleet();
  const [requestedSelectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [telemetry, setTelemetry] = useState(null);
  const [telemetryLoading, setTelemetryLoading] = useState(false);
  const [telemetryError, setTelemetryError] = useState('');
  const [health, setHealth] = useState(null);
  const [healthError, setHealthError] = useState('');
  const [healthLoading, setHealthLoading] = useState(true);
  const [tick, setTick] = useState(0);
// Phase 2.5: Observed constellations
const [observedConstellations, setObservedConstellations] = useState(null);
const [obsLoading, setObsLoading] = useState(false);
const [obsError, setObsError] = useState('');

  const selectedId = devices.some((device) => device.device_id === requestedSelectedId)
    ? requestedSelectedId
    : devices[0]?.device_id || '';

  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthError('');
    try {
      const result = await api.health();
      setHealth(result);
    } catch (healthFailure) {
      setHealth(null);
      setHealthError(healthFailure.message || 'Health check failed.');
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => loadHealth());
    return () => cancelAnimationFrame(frame);
  }, [loadHealth, tick]);

  useEffect(() => {
    let active = true;
    const frame = requestAnimationFrame(() => {
      if (!selectedId) { setTelemetry(null); setTelemetryLoading(false); return; }
      setTelemetryLoading(true);
      setTelemetryError('');
      api.deviceTelemetry(selectedId)
        .then((result) => { if (active) setTelemetry(result); })
        .catch((telemetryFailure) => {
          if (!active) return;
          setTelemetry(null);
          setTelemetryError(telemetryFailure.message || 'Could not load device telemetry.');
        })
        .finally(() => { if (active) setTelemetryLoading(false); });
    });
    return () => {
      cancelAnimationFrame(frame);
      active = false;
    };
  }, [selectedId, tick]);

  // Load observed constellations
  useEffect(() => {
    let active = true;
    const frame = requestAnimationFrame(() => {
      if (!selectedId) { setObservedConstellations(null); setObsLoading(false); return; }
      setObsLoading(true);
      setObsError('');
      api.getObservedConstellations(selectedId, 200)
        .then((result) => { if (active) setObservedConstellations(result); })
        .catch((err) => { if (active) setObsError(err.message || 'Could not load observed constellations.'); })
        .finally(() => { if (active) setObsLoading(false); });
    });
    return () => { cancelAnimationFrame(frame); active = false; };
  }, [selectedId, tick]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return devices;
    return devices.filter((device) =>
      [device.device_id, device.device_type, device.identity?.registration_number, device.identity?.vehicle_id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [devices, query]);

  const selected = devices.find((device) => device.device_id === selectedId) || null;
  const latest = telemetry?.latest || null;
  const compatibility = telemetry?.gnss_compatibility || selected?.gnss_compatibility || {};
  const reported = selected?.reported_constellations || [];

  const refreshAll = () => {
    refresh();
    setTick((value) => value + 1);
  };

  return (
    <>
      <PageHeader
        eyebrow="Insights"
        title="GNSS diagnostics"
        subtitle="Inspect receiver-reported values and registry health. Receiver capability is not inferred or claimed as verified."
        actions={
          <button type="button" className="btn btn-primary" onClick={refreshAll} disabled={refreshing || telemetryLoading || healthLoading}>
            <RefreshCw style={refreshing ? { animation: 'spin 0.9s linear infinite' } : undefined} /> Refresh diagnostics
          </button>
        }
      />

      {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}

      <InfoBanner tone="warning">
        <b>Hardware capability is unverified.</b> Constellation metadata in telemetry is receiver-reported. The console does not claim
        that the deployed IVTD supports NavIC or any other constellation without receiver documentation or hardware evidence.
      </InfoBanner>

      <div className="device-layout">
        <Card title="Devices" subtitle={`${devices.length} registry entries`} flush>
          <div style={{ padding: 12, borderBottom: '1px solid var(--line)' }}>
            <SearchInput className="diagnostics-search" value={query} onChange={setQuery} placeholder="Search devices" ariaLabel="Search devices" />
          </div>
          <div className="device-list">
            {loading && !devices.length ? (
              <LoadingBlock label="Loading devices…" />
            ) : filtered.length ? (
              filtered.map((device) => (
                <button
                  type="button"
                  key={device.id}
                  className={`device-row ${device.device_id === selectedId ? 'active' : ''}`}
                  onClick={() => setSelectedId(device.device_id)}
                >
                  <span className="timeline-dot">
                    <Cpu />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b className="mono">{device.device_id}</b>
                    <small>
                      {device.identity?.registration_number || 'Unassigned'} · {device.age_label || 'never'}
                    </small>
                  </span>
                  {device.online ? <Badge tone="success" dot>Online</Badge> : <Badge tone="neutral">Offline</Badge>}
                </button>
              ))
            ) : (
              <EmptyState title={devices.length ? 'No devices match' : 'No devices registered'} description="Register a device to inspect diagnostics." />
            )}
          </div>
        </Card>

        <div className="stack">
          <Card title="Service health" subtitle="Live API, database and receiver status" actions={<Badge tone={health?.status === 'ok' ? 'success' : 'warning'}>{health?.status || (healthError ? 'unavailable' : 'checking')}</Badge>}>
            {healthLoading && !health ? (
              <LoadingBlock label="Checking service health…" />
            ) : healthError ? (
              <ErrorBanner message={healthError} onRetry={loadHealth} />
            ) : (
              <>
                <div className="diag-grid">
                  <div className="diag-item">
                    <small>Database</small>
                    <b>{health?.database === 'ok' ? <Badge tone="success">OK</Badge> : <Badge tone="danger">Error</Badge>}</b>
                  </div>
                  <div className="diag-item">
                    <small>TCP receiver</small>
                    <b>{health?.tcp || '—'}</b>
                  </div>
                  <div className="diag-item">
                    <small>Environment</small>
                    <b>{health?.environment || '—'}</b>
                  </div>
                  <div className="diag-item">
                    <small>API version</small>
                    <b>{health?.version || '—'}</b>
                  </div>
                  <div className="diag-item">
                    <small>WebSocket clients</small>
                    <b>{fmtNumber(health?.websocket_clients ?? 0)}</b>
                  </div>
                  <div className="diag-item">
                    <small>Transport</small>
                    <b>{health?.tcp === 'listening' ? 'TCP listening' : health?.tcp === 'disabled' ? 'TCP disabled' : 'Not listening'}</b>
                  </div>
                </div>
                <div className="row small muted" style={{ marginTop: 12, alignItems: 'flex-start' }}>
                  <Server size={14} style={{ marginTop: 2 }} />
                  Health is read from <span className="mono">/health</span>. A degraded response means the database check failed; it is not a
                  placeholder value.
                </div>
              </>
            )}
          </Card>

          <Card
            title={selected ? `Device · ${selected.device_id}` : 'Device diagnostics'}
            subtitle={selected ? `${selected.device_type} · ${selected.identity?.registration_number || 'unassigned'}` : 'Select a device from the registry'}
            actions={
              selected ? (
                <>
                  {selected.online ? <Badge tone="success" dot>TCP session</Badge> : <Badge tone="neutral">No TCP session</Badge>}
                  {selected.telemetry_fresh ? <Badge tone="success">Fresh</Badge> : <Badge tone="warning">{selected.age_label || 'No data'}</Badge>}
                </>
              ) : null
            }
          >
            {!selected ? (
              <EmptyState icon={Cpu} title="No device selected" description="Choose a device from the left to inspect the latest receiver-reported values." />
            ) : telemetryLoading ? (
              <LoadingBlock label="Loading device telemetry…" />
            ) : telemetryError ? (
              <ErrorBanner message={telemetryError} onRetry={() => setTick((value) => value + 1)} />
            ) : latest ? (
              <div className="stack">
                <div className="diag-grid">
                  <div className="diag-item">
                    <small>Fix time</small>
                    <b>{fmtDateTime(latest.timestamp)}</b>
                  </div>
                  <div className="diag-item">
                    <small>Fix validity</small>
                    <b>{latest.fix_valid === true ? 'Valid' : latest.fix_valid === false ? 'Invalid' : 'Not reported'}</b>
                  </div>
                  <div className="diag-item">
                    <small>Latitude</small>
                    <b className="mono">{latest.latitude == null ? '—' : Number(latest.latitude).toFixed(6)}</b>
                  </div>
                  <div className="diag-item">
                    <small>Longitude</small>
                    <b className="mono">{latest.longitude == null ? '—' : Number(latest.longitude).toFixed(6)}</b>
                  </div>
                  <div className="diag-item">
                    <small>Altitude</small>
                    <b>{latest.altitude_m == null ? 'Not reported' : `${fmtNumber(latest.altitude_m, 1)} m`}</b>
                  </div>
                  <div className="diag-item">
                    <small>Speed / course</small>
                    <b>
                      {fmtSpeed(latest.speed)} / {latest.course == null ? '—' : `${fmtNumber(latest.course, 0)}°`}
                    </b>
                  </div>
                  <div className="diag-item">
                    <small>Satellites in view / used</small>
                    <b>
                      {latest.satellites_in_view ?? '—'} / {latest.satellites_used ?? '—'}
                    </b>
                  </div>
                  <div className="diag-item">
                    <small>HDOP / VDOP / PDOP</small>
                    <b>{[latest.hdop, latest.vdop, latest.pdop].map((value) => value ?? '—').join(' / ')}</b>
                  </div>
                  <div className="diag-item">
                    <small>Ignition</small>
                    <b>{latest.ignition == null ? 'Not reported' : latest.ignition ? 'On' : 'Off'}</b>
                  </div>
                  <div className="diag-item">
                    <small>Odometer</small>
                    <b>{latest.odometer == null ? 'Not reported' : fmtNumber(latest.odometer, 1)}</b>
                  </div>
                  <div className="diag-item">
                    <small>Message ID</small>
                    <b className="mono">{latest.message_id || '—'}</b>
                  </div>
                  <div className="diag-item">
                    <small>Source</small>
                    <b><Badge tone={rowDataSource(latest) === 'hardware' ? 'neutral' : 'warning'}>
                      {DATA_SOURCE_LABELS[rowDataSource(latest)]}
                    </Badge></b>
                  </div>
                </div>

                <div>
                  <h3 className="section-title" style={{ marginBottom: 4 }}>
                    <Satellite size={14} style={{ verticalAlign: '-2px', marginRight: 5 }} /> Constellation capability
                  </h3>
                  <p className="section-sub" style={{ marginBottom: 9 }}>
                    Values marked unverified are not a statement of hardware support.
                  </p>
                  <div className="constellation-grid">
                    {CONSTELLATIONS.map((key) => (
                      <span className="constellation" key={key}>
                        <i className={reported.includes(key) ? 'detected' : ''} />
                        {CONSTELLATION_NAMES[key]}: {compatibilityLabel(compatibility[key])}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Phase 2.5: Observed Constellations from telemetry */}
                <div>
                  <h3 className="section-title" style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Satellite size={14} style={{ verticalAlign: '-2px', marginRight: 5 }} /> Observed constellations (from telemetry)
                    {obsLoading && <span className="small muted">Loading…</span>}
                    {obsError && <span className="small" style={{ color: 'var(--danger)' }}>Error</span>}
                  </h3>
                  <p className="section-sub" style={{ marginBottom: 9 }}>
                    <b>Observed in receiver output; does not imply hardware support.</b> Simulator data excluded from hardware evidence.
                  </p>
                  
                  {obsLoading ? (
                    <LoadingBlock label="Analyzing telemetry for constellation evidence…" />
                  ) : obsError ? (
                    <ErrorBanner message={obsError} />
                  ) : observedConstellations ? (
                    <div>
                      <div className="diag-grid" style={{ marginBottom: 12 }}>
                        <div className="diag-item">
                          <small>Total fixes analyzed</small>
                          <b>{observedConstellations.total_fixes_analyzed}</b>
                        </div>
                        <div className="diag-item">
                          <small>Hardware fixes</small>
                          <b>{observedConstellations.hardware_fixes}</b>
                        </div>
                        <div className="diag-item">
                          <small>Simulator fixes (excluded)</small>
                          <b>{observedConstellations.simulator_fixes}</b>
                        </div>
                      </div>
                      
                      <div className="constellation-grid">
                        {observedConstellations.constellations.length ? (
                          observedConstellations.constellations.map((c) => (
                            <span key={c.constellation} className="constellation observed">
                              <i className="detected" />
                              {c.constellation}
                              <span className="obs-meta">
                                {c.fix_count} fix{c.fix_count !== 1 ? 'es' : ''} · Last seen: {c.last_seen ? fmtDateTime(c.last_seen) : '—'}
                              </span>
                            </span>
                          ))
                        ) : (
                          <span className="constellation empty">No constellation data observed in hardware telemetry</span>
                        )}
                      </div>
                      
                      {observedConstellations.hardware_fixes === 0 && (
                        <InfoBanner tone="warning">
                          <b>No hardware telemetry yet.</b> Observed constellations will appear once a real device reports.
                          {observedConstellations.simulator_fixes > 0 && (
                            <span> ({observedConstellations.simulator_fixes} simulator fix{observedConstellations.simulator_fixes !== 1 ? 'es' : ''} excluded.)</span>
                          )}
                        </InfoBanner>
                      )}
                    </div>
                  ) : (
                    <p className="muted">Select a device to analyze observed constellations from its telemetry.</p>
                  )}
                </div>

                {reported.length ? (
                  <InfoBanner>
                    Receiver-reported constellation metadata: {reported.map((key) => CONSTELLATION_NAMES[key] || key).join(', ')}.
                  </InfoBanner>
                ) : null}

                <div>
                  <h3 className="section-title" style={{ marginBottom: 9 }}>Latest payload</h3>
                  <pre className="code-block">{JSON.stringify(latest, null, 2)}</pre>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={Activity}
                title="No telemetry received"
                description="This device is registered but has no persisted fixes. Start the TCP receiver and simulator, or check the device connection."
              />
            )}
          </Card>

          <Card title="Registry state" subtitle="Independent of the latest telemetry">
            {selected ? (
              <div className="kv-list">
                <div className="kv-row">
                  <span>Device type</span>
                  <b>{selected.device_type}</b>
                </div>
                <div className="kv-row">
                  <span>Identifier type</span>
                  <b>{selected.identifier_type?.replaceAll('_', ' ')}</b>
                </div>
                <div className="kv-row">
                  <span>Assigned vehicle</span>
                  <b>{selected.identity?.registration_number || 'Unassigned'}</b>
                </div>
                <div className="kv-row">
                  <span>Driver / route</span>
                  <b>
                    {selected.identity?.driver_name || 'Unassigned'} · {selected.identity?.route_name || 'Unassigned'}
                  </b>
                </div>
                <div className="kv-row">
                  <span>Last communication</span>
                  <b>{selected.last_communication ? fmtDateTime(selected.last_communication) : 'Never'}</b>
                </div>
                <div className="kv-row">
                  <span>Registry flags</span>
                  <b>
                    {selected.active ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Inactive</Badge>}{' '}
                    {selected.simulated ? <Badge tone="warning">Simulated</Badge> : <Badge tone="neutral">Hardware registry</Badge>}
                  </b>
                </div>
              </div>
            ) : (
              <EmptyState icon={ShieldCheck} title="No registry entry selected" description="Diagnostics are available after a device is registered." />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

// Add API method for observed constellations
import { apiFetch } from '@services/api';
api.getObservedConstellations = (deviceId, limit = 200) => apiFetch(`/api/devices/${encodeURIComponent(deviceId)}/telemetry/observed-constellations?limit=${limit}`);
