import {
  CalendarDays,
  Clock,
  Crosshair,
  History,
  MapPin,
  Pause,
  Play,
  RadioTower,
  RotateCcw,
  Timer,
  Navigation,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@services/api';
import { FleetMap } from '@leaflet/components';
import { Badge, EmptyState, StatusBadge, cx } from '../../components/common';
import { ErrorBanner, LoadingBlock } from '../../components/feedback';
import { useFleet } from '@react/hooks/useFleet';
import { DATA_SOURCE_LABELS, DATA_SOURCE_OPTIONS, matchesDataSource, rowDataSource, SearchInput } from '../../components/forms';
import { SimulationControl } from '../../components/simulation';
import { fmtDistance, fmtDuration, fmtNumber, fmtSpeed, fmtTime, hasPosition, timeAgo } from '@react/utils/format';

const STATUS_FILTERS = [
  ['all', 'All statuses'],
  ['moving', 'Moving'],
  ['idle', 'Idle'],
  ['stopped', 'Stopped'],
  ['offline', 'Offline / no data'],
];

export function LiveTracking() {
  const { tracking, loading, error, wsState, refresh, preferences, dataSource, setDataSource, routes } = useFleet();
  const [requestedSelectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tile, setTile] = useState(null);
  const [fitSignal, setFitSignal] = useState(0);
  const [focus, setFocus] = useState(null);
  const [history, setHistory] = useState([]);
  const [historySummary, setHistorySummary] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [playIndex, setPlayIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  // Phase 2.3: Live map upgrades
  const [trailLength, setTrailLength] = useState(50); // 10, 50, 100
  const [followSelected, setFollowSelected] = useState(false);
  const requestedVehicleRef = useRef('');

  const selectedId = tracking.some((row) => row.device_id === requestedSelectedId)
    ? requestedSelectedId
    : tracking[0]?.device_id || '';

  useEffect(() => {
    const focusVehicle = (value) => {
      const target = String(value || '');
      if (!target || !tracking.length) return false;
      const row = tracking.find((item) => item.device_id === target || String(item.bus_id) === target || item.registration_number === target);
      if (!row) return false;
      requestedVehicleRef.current = target;
      setSelectedId(row.device_id);
      if (hasPosition(row)) setFocus({ latitude: row.latitude, longitude: row.longitude });
      setHistory([]);
      setHistorySummary(null);
      setHistoryError('');
      setPlayIndex(0);
      setPlaying(false);
      return true;
    };
    const requested = new URLSearchParams(window.location.search).get('vehicle');
    if (requested && requested !== requestedVehicleRef.current) focusVehicle(requested);
    const onFocus = (event) => focusVehicle(event.detail?.vehicle);
    window.addEventListener('navic:focus-vehicle', onFocus);
    return () => window.removeEventListener('navic:focus-vehicle', onFocus);
  }, [tracking]);

  const selected = tracking.find((row) => row.device_id === selectedId) || null;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tracking.filter((row) => {
      const key = row.status_key || '';
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'offline' ? key === 'offline' || key === 'no_data' : key === statusFilter);
      if (!matchesStatus) return false;
      if (!matchesDataSource(row, dataSource)) return false;
      if (!needle) return true;
      return [row.device_id, row.vehicle_id, row.registration_number, row.driver_name, row.route_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [tracking, query, statusFilter, dataSource]);

  useEffect(() => {
    if (!playing || history.length < 2) return undefined;
    if (playIndex >= history.length - 1) {
      const timer = window.setTimeout(() => setPlaying(false), 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => setPlayIndex((index) => Math.min(history.length - 1, index + 1)), Math.round(900 / playbackSpeed));
    return () => window.clearTimeout(timer);
  }, [playing, playIndex, history, playbackSpeed]);

  const pin = history.length ? history[Math.min(playIndex, history.length - 1)] : null;

  const mapVehicles = useMemo(
    () =>
      tracking.map((row) =>
        selected && row.device_id === selected.device_id && pin
          ? { ...row, latitude: pin.latitude, longitude: pin.longitude, timestamp: pin.timestamp, speed: pin.speed }
          : row,
      ),
    [tracking, selected, pin],
  );

  const selectVehicle = (vehicle) => {
    setSelectedId(vehicle.device_id);
    setFocus({ latitude: vehicle.latitude, longitude: vehicle.longitude });
    setHistory([]);
    setHistorySummary(null);
    setHistoryError('');
    setPlayIndex(0);
    setPlaying(false);
  };

  const loadHistory = async () => {
    if (!selected) return;
    if (!selected.bus_id) {
      setHistoryError('This device is not assigned to a vehicle, so bus history is unavailable. Assign it to a vehicle first.');
      setHistory([]);
      return;
    }
    setHistoryLoading(true);
    setHistoryError('');
    setPlaying(false);
    try {
      const params = new URLSearchParams({ limit: '5000' });
      if (startTime) params.set('start_time', new Date(startTime).toISOString());
      if (endTime) params.set('end_time', new Date(endTime).toISOString());
      const result = await api.history(selected.bus_id, `?${params.toString()}`);
      const points = Array.isArray(result?.history) ? result.history.filter(hasPosition) : [];
      setHistory(points);
      setHistorySummary(result?.summary || null);
      setPlayIndex(0);
      if (!points.length) {
        setHistoryError('No recorded fixes match the selected range.');
      } else {
        setFocus({ latitude: points[0].latitude, longitude: points[0].longitude });
      }
    } catch (historyFailure) {
      setHistory([]);
      setHistorySummary(null);
      setHistoryError(historyFailure.message || 'Could not load history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    setHistorySummary(null);
    setHistoryError('');
    setPlaying(false);
    setPlayIndex(0);
  };

  const mappable = tracking.filter(hasPosition).length;
  const currentPoint = pin || selected?.latest || null;

  return (
    <div className="tracking-layout">
      <aside className="tracking-side">
        <div className="tracking-side-head">
          <div className="row between">
            <div>
              <h2>Fleet positions</h2>
              <p>
                {mappable} of {tracking.length} with a position
              </p>
            </div>
            <Badge tone={wsState === 'online' ? 'success' : 'neutral'} dot>
              {wsState === 'online' ? 'Live' : 'Polling'}
            </Badge>
          </div>
          <button type="button" className="btn btn-sm" style={{ marginTop: 12, width: '100%' }} onClick={() => setFitSignal((value) => value + 1)}>
            <Crosshair /> Fit all vehicles
          </button>
          <SimulationControl />
        </div>

        <div className="tracking-filters">
          <SearchInput value={query} onChange={setQuery} placeholder="Search vehicle, driver, device" ariaLabel="Search vehicles" className="grow" style={{ maxWidth: 'none' }} />
          <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status">
            {STATUS_FILTERS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select className="input" value={dataSource} onChange={(event) => setDataSource(event.target.value)} aria-label="Filter by data source">
            {DATA_SOURCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="tracking-list">
          {loading && !tracking.length ? (
            <LoadingBlock label="Loading positions…" />
          ) : filtered.length ? (
            filtered.map((vehicle) => (
              <button
                type="button"
                key={vehicle.device_id}
                className={cx('tracking-item', vehicle.device_id === selectedId && 'active')}
                onClick={() => selectVehicle(vehicle)}
              >
                <span className="tracking-item-icon">
                  <RadioTower />
                </span>
                <span className="tracking-item-main">
                  <b>{vehicle.registration_number || vehicle.vehicle_id || vehicle.device_id}</b>
                  <small>
                    {vehicle.driver_name || 'Unassigned driver'} · {vehicle.timestamp ? timeAgo(vehicle.timestamp) : 'No fix'}
                  </small>
                </span>
                <StatusBadge status={vehicle.status} statusKey={vehicle.status_key} />
              </button>
            ))
          ) : (
            <EmptyState
              title={tracking.length ? 'No matching vehicles' : 'No active devices'}
              description={tracking.length ? 'Adjust the search or status filter.' : 'Register a tracking device and assign it to a vehicle.'}
            />
          )}
        </div>
      </aside>

      <div className="tracking-map">
        <FleetMap
          vehicles={mapVehicles}
          selectedId={selectedId}
          onSelect={selectVehicle}
          history={history}
          focus={focus}
          fitSignal={fitSignal}
          tile={tile || preferences?.default_map_view || 'streets'}
          onTileChange={setTile}
          height="100%"
          showLegend
          emptyNote={
            tracking.length && !mappable
              ? 'Devices are registered but none has reported a valid latitude and longitude yet.'
              : undefined
          }
          trailLength={trailLength}
          setTrailLength={setTrailLength}
          followSelected={followSelected}
          setFollowSelected={setFollowSelected}
          routeStops={selected?.route_stops || null}
          routeColor={selected?.route_color || '#0f766e'}
        />

        {error ? (
          <div style={{ position: 'absolute', zIndex: 850, left: 14, top: 60, right: 14 }}>
            <ErrorBanner message={error} onRetry={refresh} />
          </div>
        ) : null}

        {selected ? (
          <section className="tracking-detail" aria-label="Selected vehicle">
            <div className="tracking-detail-head">
              <div>
                <b>{selected.registration_number || selected.vehicle_id || selected.device_id}</b>
                <small>
                  {selected.route_name || 'Unassigned route'} · {selected.device_id}
                </small>
              </div>
              <StatusBadge status={selected.status} statusKey={selected.status_key} />
            </div>

            <div className="detail-grid">
              {selected ? (
                <>
                  <div>
                    <small>Driver</small>
                    <b>{selected.driver_name || 'Unassigned'}</b>
                  </div>
                  <div>
                    <small>Speed</small>
                    <b>{fmtSpeed(selected.speed)}</b>
                  </div>
                  <div>
                    <small>Last fix</small>
                    <b>{selected.timestamp ? timeAgo(selected.timestamp) : 'No data'}</b>
                  </div>
                  <div>
                    <small>Course</small>
                    <b>{selected.course == null ? '—' : `${fmtNumber(selected.course, 0)}°`}</b>
                  </div>
                  <div>
                    <small>Position</small>
                    <b className="mono">
                      {hasPosition(selected) ? `${Number(selected.latitude).toFixed(5)}, ${Number(selected.longitude).toFixed(5)}` : 'Unavailable'}
                    </b>
                  </div>
                  <div>
                    <small>Source</small>
                    <b>
                      {!selected.timestamp ? (
                        'No telemetry'
                      ) : (
                        <Badge tone={rowDataSource(selected) === 'hardware' ? 'neutral' : 'warning'}>
                          {DATA_SOURCE_LABELS[rowDataSource(selected)]}
                        </Badge>
                      )}
                    </b>
                  </div>
                </>
              ) : (
                <div style={{ opacity: 0.6 }}>
                  <div><small>Driver</small><b>No vehicle selected</b></div>
                  <div><small>Speed</small><b>—</b></div>
                  <div><small>Last fix</small><b>No data</b></div>
                  <div><small>Course</small><b>—</b></div>
                  <div><small>Position</small><b>Unavailable</b></div>
                  <div><small>Source</small><b>—</b></div>
                </div>
              )}
            </div>

            <div className="playback-bar">
              <div className="row between" style={{ marginBottom: 8 }}>
                <span className="small" style={{ fontWeight: 600 }}>
                  <History size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                  Recorded history
                </span>
                <Badge tone="neutral">{history.length ? `${history.length} fixes` : 'Not loaded'}</Badge>
              </div>

              <div className="row" style={{ gap: 7, flexWrap: 'wrap' }}>
                <label className="small muted" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CalendarDays size={12} /> From
                  <input type="datetime-local" className="input" style={{ width: 150, minHeight: 28, padding: '3px 6px' }} value={startTime} onChange={(event) => setStartTime(event.target.value)} />
                </label>
                <label className="small muted" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  To
                  <input type="datetime-local" className="input" style={{ width: 150, minHeight: 28, padding: '3px 6px' }} value={endTime} onChange={(event) => setEndTime(event.target.value)} />
                </label>
                <button type="button" className="btn btn-sm" onClick={loadHistory} disabled={historyLoading}>
                  {historyLoading ? 'Loading…' : 'Load'}
                </button>
                {history.length ? (
                  <button type="button" className="btn btn-sm btn-ghost" onClick={clearHistory}>
                    Clear
                  </button>
                ) : null}
              </div>

              {historyError ? <div className="form-error" style={{ marginTop: 8 }}>{historyError}</div> : null}

              {history.length ? (
                <>
                  <div className="playback-row" style={{ marginTop: 10 }}>
                    <button type="button" className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => setPlaying((value) => !value)} aria-label={playing ? 'Pause playback' : 'Play playback'}>
                      {playing ? <Pause /> : <Play />}
                    </button>
                    <button type="button" className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => { setPlaying(false); setPlayIndex(0); }} aria-label="Reset playback">
                      <RotateCcw />
                    </button>
                    <input
                      type="range"
                      min="0"
                      max={Math.max(0, history.length - 1)}
                      value={playIndex}
                      onChange={(event) => {
                        setPlaying(false);
                        setPlayIndex(Number(event.target.value));
                      }}
                      aria-label="History playback position"
                    />
                    <select className="input" style={{ width: 'auto', minHeight: 28, padding: '3px 5px' }} value={playbackSpeed} onChange={(event) => setPlaybackSpeed(Number(event.target.value))} aria-label="Playback speed">
                      <option value={1}>1×</option>
                      <option value={2}>2×</option>
                      <option value={4}>4×</option>
                    </select>
                  </div>
                  <div className="playback-meta">
                    <span>{currentPoint?.timestamp ? fmtTime(currentPoint.timestamp) : '—'}</span>
                    <span>
                      {playIndex + 1} / {history.length}
                    </span>
                  </div>
                  {historySummary ? (
                    <div className="playback-meta" style={{ marginTop: 3 }}>
                      <span>{fmtDistance(historySummary.distance_km)}</span>
                      <span>
                        <Timer size={10} style={{ verticalAlign: '-1px' }} /> {fmtDuration(historySummary.duration_minutes)}
                      </span>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          </section>
        ) : (
          <div className="tracking-detail">
            <EmptyState icon={MapPin} title="No vehicle selected" description="Choose a vehicle from the list to inspect its latest state and history." />
          </div>
        )}
      </div>
    </div>
  );
}
