/*
 * Trip history derives trips from the report API using selected filters. Rows
 * stay visible during a transient network outage and refresh after recovery.
 */
import { CalendarDays, Download, History, RefreshCw, Route, Timer, Play } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@services/api';
import { Badge, Card, EmptyState, PageHeader } from '../../components/common';
import { StatCard } from '../../components/cards';
import { Field } from '../../components/forms';
import { Pagination } from '../../components/tables';
import { ErrorBanner, InfoBanner, LoadingBlock, useToast } from '../../components/feedback';
import { useFleet } from '@react/hooks/useFleet';
import { TripReplayModal } from '../../components/trip/TripReplayModal';
import { downloadCsv, fmtDateTime, fmtDistance, fmtDuration, fmtNumber, fmtSpeed } from '@react/utils/format';

function buildParams(filters, page, pageSize) {
  const params = new URLSearchParams({ limit: String(pageSize), offset: String(page * pageSize) });
  if (filters.vehicleId) params.set('vehicle_id', filters.vehicleId);
  if (filters.start) params.set('start_date', new Date(filters.start).toISOString());
  if (filters.end) params.set('end_date', new Date(filters.end).toISOString());
  return params;
}

export function Trips() {
  const { vehicles, apiStatus } = useFleet();
  const toast = useToast();
  const [form, setForm] = useState({ vehicleId: '', start: '', end: '' });
  const [applied, setApplied] = useState({ vehicleId: '', start: '', end: '' });
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [rules, setRules] = useState({});
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [replayTrip, setReplayTrip] = useState(null);
  const [replayOpen, setReplayOpen] = useState(false);

  const openReplay = (trip) => {
    setReplayTrip(trip);
    setReplayOpen(true);
  };

  const closeReplay = () => {
    setReplayOpen(false);
    setReplayTrip(null);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = buildParams(applied, page, pageSize);
      const result = await api.reports('trip', params.toString());
      setRows(Array.isArray(result?.data) ? result.data : []);
      setCount(Number(result?.count || 0));
      setRules(result?.rules || {});
    } catch (loadError) {
      if (loadError.status) setError(loadError);
    } finally {
      setLoading(false);
    }
  }, [applied, page, pageSize]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => load());
    return () => cancelAnimationFrame(frame);
  }, [load]);

  // Once the shared health probe reports recovery, reload this route's own
  // derived trip data; keeping rows on network failure avoids a false empty state.
  useEffect(() => {
    if (apiStatus !== 'online') return undefined;
    const timer = window.setTimeout(() => load(), 0);
    return () => window.clearTimeout(timer);
  }, [apiStatus, load]);

  const summary = useMemo(() => {
    return rows.reduce(
      (accumulator, trip) => ({
        distance: accumulator.distance + (Number(trip.distance_km) || 0),
        duration: accumulator.duration + (Number(trip.duration_minutes) || 0),
        records: accumulator.records + (Number(trip.records) || 0),
        maxSpeed: Math.max(accumulator.maxSpeed, Number(trip.max_speed_kmh) || 0),
      }),
      { distance: 0, duration: 0, records: 0, maxSpeed: 0 },
    );
  }, [rows]);

  const apply = (event) => {
    event.preventDefault();
    setPage(0);
    setApplied({ ...form });
  };

  const reset = () => {
    const empty = { vehicleId: '', start: '', end: '' };
    setForm(empty);
    setApplied(empty);
    setPage(0);
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const params = buildParams(applied, 0, 5000);
      params.delete('limit');
      params.delete('offset');
      const csv = await api.reportCsv('trip', params.toString());
      const blob = new Blob([csv || ''], { type: 'text/csv;charset=utf-8' });
      const anchor = document.createElement('a');
      anchor.href = URL.createObjectURL(blob);
      anchor.download = 'trip-report.csv';
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
      toast.success('Trip CSV downloaded.');
    } catch (exportError) {
      toast.error(exportError.message || 'Could not export trips.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Trip history"
        subtitle="Trips are derived from persisted fixes. A gap of more than 30 minutes between consecutive fixes starts a new trip."
        actions={
          <>
            <button type="button" className="btn" onClick={load} disabled={loading}>
              <RefreshCw style={loading ? { animation: 'spin 0.9s linear infinite' } : undefined} /> Refresh
            </button>
            <button type="button" className="btn btn-primary" onClick={exportCsv} disabled={exporting || !rows.length}>
              <Download /> Export CSV
            </button>
          </>
        }
      />

      {error ? <ErrorBanner message={error} onRetry={load} resource="trips" /> : null}

      <InfoBanner>
        Trips are not a separately stored entity. They are recomputed from telemetry whenever this page or a report runs, so the result
        always reflects the recorded fixes for the selected range.
      </InfoBanner>

      <div className="stat-grid">
        <StatCard label="Trips in page" value={fmtNumber(rows.length)} hint={`${fmtNumber(count)} trip(s) match the filters`} icon={History} tone="brand" />
        <StatCard label="Distance in page" value={fmtDistance(summary.distance)} hint="Great-circle segments" icon={Route} tone="blue" />
        <StatCard label="Duration in page" value={fmtDuration(summary.duration)} hint="First to last fix per trip" icon={Timer} tone="violet" />
        <StatCard label="Highest max speed" value={fmtSpeed(summary.maxSpeed)} hint="Across trips shown on this page" icon={CalendarDays} tone="amber" />
      </div>

      <Card
        title="Derived trips"
        subtitle={`${fmtNumber(summary.records)} recorded fix(es) across the trips shown`}
        flush
      >
        <form className="filter-bar" onSubmit={apply}>
          <Field label="Vehicle" className="grow">
            <select value={form.vehicleId} onChange={(event) => setForm({ ...form, vehicleId: event.target.value })}>
              <option value="">All vehicles</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.vehicle_id}>
                  {vehicle.registration_number} · {vehicle.vehicle_id}
                </option>
              ))}
            </select>
          </Field>
          <Field label="From">
            <input type="datetime-local" value={form.start} onChange={(event) => setForm({ ...form, start: event.target.value })} />
          </Field>
          <Field label="To">
            <input type="datetime-local" value={form.end} onChange={(event) => setForm({ ...form, end: event.target.value })} />
          </Field>
          <button type="submit" className="btn btn-primary">
            Apply filters
          </button>
          <button type="button" className="btn" onClick={reset}>
            Reset
          </button>
        </form>

        {loading ? (
          <LoadingBlock label="Loading derived trips…" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Trip</th>
                  <th>Vehicle</th>
                  <th>Start</th>
                  <th>End</th>
                  <th className="num">Duration</th>
                  <th className="num">Distance</th>
                  <th className="num">Avg speed</th>
                  <th className="num">Max speed</th>
                  <th className="num">Fixes</th>
                  <th className="actions">Replay</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map((trip) => (
                    <tr key={`${trip.device_id}-${trip.start_time}-${trip.trip}`}>
                      <td>#{trip.trip} {trip.simulated ? <Badge tone="warning">Simulated</Badge> : null}</td>
                      <td>
                        <span className="primary">{trip.registration_number || trip.vehicle_id || 'Unassigned'}</span>
                        <span className="secondary mono">{trip.device_id}</span>
                      </td>
                      <td>{fmtDateTime(trip.start_time)}</td>
                      <td>{fmtDateTime(trip.end_time)}</td>
                      <td className="num">{fmtDuration(trip.duration_minutes)}</td>
                      <td className="num">{fmtDistance(trip.distance_km)}</td>
                      <td className="num">{fmtSpeed(trip.avg_speed_kmh)}</td>
                      <td className="num">{fmtSpeed(trip.max_speed_kmh)}</td>
                      <td className="num">{fmtNumber(trip.records)}</td>
                      <td className="actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => openReplay(trip)}
                          aria-label={`Replay trip #${trip.trip}`}
                          title="Replay this trip"
                        >
                          <Play size={14} /> Replay
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10}>
                      <EmptyState
                        icon={History}
                        title="No trips recorded for this selection"
                        description="Trips appear once valid fixes have been persisted for the selected vehicles and time range. Adjust the filters, or run the simulator to generate labelled test telemetry."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          page={page}
          pageSize={pageSize}
          total={count}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(0);
          }}
        />
        {rules?.trip_definition ? <div className="rules-note">{rules.trip_definition} {rules.distance ? `Distance: ${rules.distance}.` : ''}</div> : null}
      </Card>

      <Card title="Report provenance" subtitle="How these rows are produced">
        <div className="kv-list">
          <div className="kv-row">
            <span>Trip split rule</span>
            <b>Consecutive fixes from one device separated by at most 30 minutes</b>
          </div>
          <div className="kv-row">
            <span>Distance method</span>
            <b>Great-circle segments; gaps over 30 minutes or 100 km are ignored</b>
          </div>
          <div className="kv-row">
            <span>Data source</span>
            <b>Persisted location history only</b>
          </div>
          <div className="kv-row">
            <span>Current page range</span>
            <b>
              {applied.start || applied.end
                ? `${applied.start || 'start'} → ${applied.end || 'now'}`
                : 'All recorded telemetry'}
            </b>
          </div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <Badge tone="neutral">No synthetic values</Badge>
          <Badge tone="neutral">Simulation flags preserved</Badge>
        </div>
      </Card>

      <TripReplayModal
        isOpen={replayOpen}
        onClose={closeReplay}
        trip={replayTrip}
      />
    </>
  );
}
