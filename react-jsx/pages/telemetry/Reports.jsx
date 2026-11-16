import { Download, FileBarChart, FileText, Filter, Printer, RefreshCw, BarChart2, Table } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@services/api';
import { Badge, Card, EmptyState, PageHeader, cx } from '../../components/common';
import { DATA_SOURCE_OPTIONS, Field, matchesDataSource } from '../../components/forms';
import { Pagination } from '../../components/tables';
import { ErrorBanner, InfoBanner, LoadingBlock, useToast } from '../../components/feedback';
import { REPORT_CATALOG, REPORT_NAMES } from '../../utils/config';
import { useFleet } from '@react/hooks/useFleet';
import { BarChart, HorizontalBars } from '../../components/charts';
import {
  displayCell,
  fmtDate,
  fmtDateTime,
  fmtDistance,
  fmtDuration,
  fmtNumber,
  fmtSpeed,
  titleCase,
} from '@react/utils/format';

function buildParams(type, filters, page, pageSize) {
  const params = new URLSearchParams({ limit: String(pageSize), offset: String(page * pageSize) });
  if (filters.vehicleId) params.set('vehicle_id', filters.vehicleId);
  if (filters.deviceId) params.set('imei', filters.deviceId);
  if (filters.start) params.set('start_date', new Date(filters.start).toISOString());
  if (filters.end) params.set('end_date', new Date(filters.end).toISOString());
  return { params, type };
}

function formatCell(key, value) {
  if (value === null || value === undefined || value === '') return '—';
  const lower = key.toLowerCase();
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (lower === 'date') return fmtDate(value);
  if (lower.includes('time') || lower.includes('_at') || lower.includes('last_seen') || lower.includes('first_seen') || lower.includes('last_fix') || lower.includes('last_received')) {
    return fmtDateTime(value);
  }
  if (lower === 'distance_km' || lower.endsWith('_distance_km')) return fmtDistance(value);
  if (lower === 'speed' || lower.endsWith('_speed') || lower.includes('speed_kmh')) return fmtSpeed(value);
  if (lower === 'duration_minutes' || lower === 'moving_minutes') return lower === 'duration_minutes' ? fmtDuration(value) : `${fmtNumber(value, 1)} min`;
  if (lower.includes('percent')) return `${fmtNumber(value, 1)}%`;
  if (lower.includes('latitude') || lower.includes('longitude')) return Number(value).toFixed(6);
  if (typeof value === 'object') return JSON.stringify(value);
  return displayCell(value);
}

function columnList(rows) {
  const keys = new Set();
  rows.forEach((row) => Object.keys(row || {}).forEach((key) => keys.add(key)));
  return [...keys];
}

export function Reports() {
  const { vehicles, devices, dataSource, setDataSource } = useFleet();
  const toast = useToast();
  const [type, setType] = useState('trip');
  const [form, setForm] = useState({ vehicleId: '', deviceId: '', start: '', end: '' });
  const [applied, setApplied] = useState({ vehicleId: '', deviceId: '', start: '', end: '' });
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [rules, setRules] = useState({});
  const [period, setPeriod] = useState(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'chart'

  const selectedReport = useMemo(
    () => REPORT_CATALOG.flatMap((group) => group.items).find((item) => item.type === type),
    [type],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { params } = buildParams(type, applied, page, pageSize);
      const result = await api.reports(type, params.toString());
      setRows(Array.isArray(result?.data) ? result.data : []);
      setCount(Number(result?.count || 0));
      setRules(result?.rules || {});
      setPeriod(result?.period || null);
    } catch (loadError) {
      setRows([]);
      setCount(0);
      setRules({});
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }, [type, applied, page, pageSize]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => load());
    return () => cancelAnimationFrame(frame);
  }, [load]);

  const columns = useMemo(() => columnList(rows), [rows]);

  const filteredRows = useMemo(() => {
    if (dataSource === 'all') return rows;
    return rows.filter((row) => matchesDataSource(row, dataSource));
  }, [rows, dataSource]);

  // Chart data computation
  const chartData = useMemo(() => {
    if (!filteredRows.length) return null;
    
    const data = filteredRows;
    const charts = {};
    
    switch (type) {
      case 'trip':
      case 'trip-distance':
      {
        // Distance per vehicle per day
        const distByVehicle = {};
        const distByDate = {};
        data.forEach((row) => {
          const vehicle = row.registration_number || row.vehicle_id || row.device_id || 'Unknown';
          const date = row.start_time ? new Date(row.start_time).toISOString().split('T')[0] : 'Unknown';
          const dist = Number(row.distance_km) || 0;
          
          distByVehicle[vehicle] = (distByVehicle[vehicle] || 0) + dist;
          distByDate[date] = (distByDate[date] || 0) + dist;
        });
        
        charts.distancePerVehicle = {
          type: 'bar',
          title: 'Distance per Vehicle',
          data: Object.entries(distByVehicle).map(([vehicle, distance]) => ({
            label: vehicle.length > 20 ? vehicle.slice(0, 18) + '…' : vehicle,
            distance: Math.round(distance * 100) / 100,
          })).sort((a, b) => b.distance - a.distance).slice(0, 15),
          xKey: 'label',
          series: [{ key: 'distance', label: 'Distance (km)', color: '#0d9488' }],
          formatValue: (v) => `${v} km`,
        };
        
        charts.distancePerDay = {
          type: 'bar',
          title: 'Distance per Day',
          data: Object.entries(distByDate).map(([date, distance]) => ({
            label: date,
            distance: Math.round(distance * 100) / 100,
          })).sort((a, b) => a.label.localeCompare(b.label)),
          xKey: 'label',
          series: [{ key: 'distance', label: 'Distance (km)', color: '#0ea5e9' }],
          formatValue: (v) => `${v} km`,
        };
        
        // Max speed per vehicle
        const maxSpeedByVehicle = {};
        data.forEach((row) => {
          const vehicle = row.registration_number || row.vehicle_id || row.device_id || 'Unknown';
          const speed = Number(row.max_speed_kmh) || 0;
          if (speed > (maxSpeedByVehicle[vehicle] || 0)) {
            maxSpeedByVehicle[vehicle] = speed;
          }
        });
        
        charts.maxSpeedPerVehicle = {
          type: 'horizontalBars',
          title: 'Max Speed per Vehicle',
          items: Object.entries(maxSpeedByVehicle).map(([vehicle, speed]) => ({
            label: vehicle,
            value: speed,
            color: '#0d9488',
          })).sort((a, b) => b.value - a.value).slice(0, 15),
          formatValue: (v) => `${v} km/h`,
        };
        
        // Trips per day
        const tripsByDate = {};
        data.forEach((row) => {
          const date = row.start_time ? new Date(row.start_time).toISOString().split('T')[0] : 'Unknown';
          tripsByDate[date] = (tripsByDate[date] || 0) + 1;
        });
        
        charts.tripsPerDay = {
          type: 'bar',
          title: 'Trips per Day',
          data: Object.entries(tripsByDate).map(([date, count]) => ({
            label: date,
            count,
          })).sort((a, b) => a.label.localeCompare(b.label)),
          xKey: 'label',
          series: [{ key: 'count', label: 'Trips', color: '#7c3aed' }],
          formatValue: (v) => `${v} trips`,
        };
        break;
      }
      case 'stoppages':
      case 'stop':
      {
        // Stop duration per vehicle
        const stopDurationByVehicle = {};
        data.forEach((row) => {
          const vehicle = row.registration_number || row.vehicle_id || row.device_id || 'Unknown';
          const duration = Number(row.duration_minutes) || 0;
          stopDurationByVehicle[vehicle] = (stopDurationByVehicle[vehicle] || 0) + duration;
        });
        
        charts.stopDurationPerVehicle = {
          type: 'horizontalBars',
          title: 'Stopped/Idle Time per Vehicle',
          items: Object.entries(stopDurationByVehicle).map(([vehicle, duration]) => ({
            label: vehicle,
            value: Math.round(duration * 10) / 10,
            color: '#0d9488',
          })).sort((a, b) => b.value - a.value).slice(0, 15),
          formatValue: (v) => `${v} min`,
        };
        
        // Stops per day
        const stopsByDate = {};
        data.forEach((row) => {
          const date = row.start_time ? new Date(row.start_time).toISOString().split('T')[0] : 'Unknown';
          stopsByDate[date] = (stopsByDate[date] || 0) + 1;
        });
        
        charts.stopsPerDay = {
          type: 'bar',
          title: 'Stoppages per Day',
          data: Object.entries(stopsByDate).map(([date, count]) => ({
            label: date,
            count,
          })).sort((a, b) => a.label.localeCompare(b.label)),
          xKey: 'label',
          series: [{ key: 'count', label: 'Stoppages', color: '#dc2626' }],
          formatValue: (v) => `${v} stops`,
        };
        break;
      }
      case 'vehicle-activity':
      case 'vehicle-utilization':
      {
        // Distance per vehicle
        const activityDistByVehicle = {};
        data.forEach((row) => {
          const vehicle = row.registration_number || row.vehicle_id || row.device_id || 'Unknown';
          const dist = Number(row.distance_km) || 0;
          activityDistByVehicle[vehicle] = (activityDistByVehicle[vehicle] || 0) + dist;
        });
        
        charts.distancePerVehicle = {
          type: 'horizontalBars',
          title: 'Distance per Vehicle',
          items: Object.entries(activityDistByVehicle).map(([vehicle, distance]) => ({
            label: vehicle,
            value: Math.round(distance * 100) / 100,
            color: '#0d9488',
          })).sort((a, b) => b.value - a.value).slice(0, 15),
          formatValue: (v) => `${v} km`,
        };
        
        // Active days per vehicle
        const activeDaysByVehicle = {};
        data.forEach((row) => {
          const vehicle = row.registration_number || row.vehicle_id || row.device_id || 'Unknown';
          if (!activeDaysByVehicle[vehicle]) activeDaysByVehicle[vehicle] = new Set();
          const date = row.date || (row.first_seen ? new Date(row.first_seen).toISOString().split('T')[0] : null);
          if (date) activeDaysByVehicle[vehicle].add(date);
        });
        
        charts.activeDaysPerVehicle = {
          type: 'horizontalBars',
          title: 'Active Days per Vehicle',
          items: Object.entries(activeDaysByVehicle).map(([vehicle, dates]) => ({
            label: vehicle,
            value: dates.size,
            color: '#0ea5e9',
          })).sort((a, b) => b.value - a.value).slice(0, 15),
          formatValue: (v) => `${v} days`,
        };
        break;
      }
      case 'daily-activity':
      {
        // Distance per day
        const dailyDist = {};
        data.forEach((row) => {
          const date = row.date || 'Unknown';
          const dist = Number(row.distance_km) || 0;
          dailyDist[date] = (dailyDist[date] || 0) + dist;
        });
        
        charts.distancePerDay = {
          type: 'bar',
          title: 'Distance per Day',
          data: Object.entries(dailyDist).map(([date, distance]) => ({
            label: date,
            distance: Math.round(distance * 100) / 100,
          })).sort((a, b) => a.label.localeCompare(b.label)),
          xKey: 'label',
          series: [{ key: 'distance', label: 'Distance (km)', color: '#0d9488' }],
          formatValue: (v) => `${v} km`,
        };
        
        // Active vehicles per day
        const activeVehiclesPerDay = {};
        data.forEach((row) => {
          const date = row.date || 'Unknown';
          activeVehiclesPerDay[date] = row.active_vehicles || 0;
        });
        
        charts.activeVehiclesPerDay = {
          type: 'bar',
          title: 'Active Vehicles per Day',
          data: Object.entries(activeVehiclesPerDay).map(([date, count]) => ({
            label: date,
            count,
          })).sort((a, b) => a.label.localeCompare(b.label)),
          xKey: 'label',
          series: [{ key: 'count', label: 'Vehicles', color: '#0ea5e9' }],
          formatValue: (v) => `${v} vehicles`,
        };
        break;
      }
      default:
      {
        // Generic numeric columns charts
        const numericCols = Object.keys(data[0] || {}).filter(key => {
          const vals = data.map(r => r[key]).filter(v => v != null);
          return vals.length && vals.every(v => typeof v === 'number' || !isNaN(Number(v)));
        });
        
        if (numericCols.length) {
          // First numeric column as bar chart
          const firstNum = numericCols[0];
          const labelKey = Object.keys(data[0] || {}).find(k => 
            typeof data[0][k] === 'string' && !['timestamp', 'created_at', 'updated_at'].includes(k.toLowerCase())
          ) || Object.keys(data[0] || {})[0];
          
          charts[`${firstNum}Chart`] = {
            type: 'bar',
            title: titleCase(firstNum.replace(/_/g, ' ')),
            data: data.map((row, i) => ({
              label: row[labelKey] || `Row ${i + 1}`,
              value: Number(row[firstNum]) || 0,
            })).slice(0, 20),
            xKey: 'label',
            series: [{ key: 'value', label: titleCase(firstNum), color: '#0d9488' }],
            formatValue: (v) => String(v),
          };
        }
      }
    }
    
    return Object.keys(charts).length ? charts : null;
  }, [filteredRows, type]);

  const apply = (event) => {
    event.preventDefault();
    setPage(0);
    setApplied({ ...form });
  };

  const reset = () => {
    const empty = { vehicleId: '', deviceId: '', start: '', end: '' };
    setForm(empty);
    setApplied(empty);
    setPage(0);
  };

  const chooseType = (nextType) => {
    setType(nextType);
    setPage(0);
    setRows([]);
    setCount(0);
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const { params } = buildParams(type, applied, 0, 5000);
      params.delete('limit');
      params.delete('offset');
      const csv = await api.reportCsv(type, params.toString());
      const blob = new Blob([csv || ''], { type: 'text/csv;charset=utf-8' });
      const anchor = document.createElement('a');
      anchor.href = URL.createObjectURL(blob);
      anchor.download = `${type}-report.csv`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
      toast.success('Report CSV downloaded.');
    } catch (exportError) {
      toast.error(exportError.message || 'Could not export the report.');
    } finally {
      setExporting(false);
    }
  };

  const idleUnsupported = type === 'idle' && rules.supported === false;

  return (
    <>
      <PageHeader
        eyebrow="Insights"
        title="Reports"
        subtitle="Reports are computed on request from persisted telemetry. There are no cached or fabricated statistics."
        actions={
          <>
            <div className="view-toggle" role="group" aria-label="View mode">
              <button
                type="button"
                className={cx('btn btn-sm', viewMode === 'table' ? 'btn-primary' : 'btn-ghost')}
                onClick={() => setViewMode('table')}
                aria-pressed={viewMode === 'table'}
              >
                <Table size={14} /> Table
              </button>
              <button
                type="button"
                className={cx('btn btn-sm', viewMode === 'chart' ? 'btn-primary' : 'btn-ghost')}
                onClick={() => setViewMode('chart')}
                aria-pressed={viewMode === 'chart'}
                disabled={!chartData || Object.keys(chartData).length === 0}
              >
                <BarChart2 size={14} /> Charts
              </button>
            </div>
            <button type="button" className="btn" onClick={load} disabled={loading}>
              <RefreshCw style={loading ? { animation: 'spin 0.9s linear infinite' } : undefined} /> Run report
            </button>
            <button type="button" className="btn" onClick={() => window.print()}>
              <Printer /> Print
            </button>
            <button type="button" className="btn btn-primary" onClick={exportCsv} disabled={exporting || !rows.length}>
              <Download /> Export CSV
            </button>
          </>
        }
      />

      {error ? <ErrorBanner message={error} onRetry={load} resource="reports" /> : null}

      <div className="report-layout">
        <aside className="card report-menu" aria-label="Report catalogue">
          {REPORT_CATALOG.map((group) => (
            <div className="report-group" key={group.group}>
              <div className="report-group-label">{group.group}</div>
              {group.items.map((item) => (
                <button
                  type="button"
                  key={item.type}
                  data-report-type={item.type}
                  className={`report-option ${item.type === type ? 'active' : ''}`}
                  onClick={() => chooseType(item.type)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </aside>

        <div className="stack">
          <Card
            title={REPORT_NAMES[type] || titleCase(type)}
            subtitle={selectedReport?.description || 'Telemetry report'}
            actions={<Badge tone="neutral">{REPORT_NAMES[type] ? titleCase(type) : type}</Badge>}
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
              <Field label="Device">
                <select value={form.deviceId} onChange={(event) => setForm({ ...form, deviceId: event.target.value })}>
                  <option value="">All devices</option>
                  {devices.map((device) => (
                    <option key={device.id} value={device.device_id}>
                      {device.device_id}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Source">
                <select value={dataSource} onChange={(event) => setDataSource(event.target.value)} aria-label="Filter by data source">
                  {DATA_SOURCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
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
                <Filter /> Apply
              </button>
              <button type="button" className="btn" onClick={reset}>
                Reset
              </button>
            </form>

            <div className="report-summary">
              <span>
                <b>{fmtNumber(count)}</b> row(s) match
              </span>
              <span>Page size {pageSize}</span>
              {period?.start || period?.end ? (
                <span>
                  Period: <b>{period.start ? fmtDateTime(period.start) : 'beginning'}</b> → <b>{period.end ? fmtDateTime(period.end) : 'now'}</b>
                </span>
              ) : (
                <span>Period: all stored telemetry</span>
              )}
              {applied.vehicleId ? <Badge tone="info">Vehicle {applied.vehicleId}</Badge> : null}
              {applied.deviceId ? <Badge tone="info">Device {applied.deviceId}</Badge> : null}
            </div>

            {idleUnsupported ? (
              <div style={{ padding: 16 }}>
                <InfoBanner tone="warning">
                  <b>Idle reporting is unavailable for this selection.</b> {rules.reason} The current schema stores ignition only when a
                  device reports it; idle is never inferred from GPS speed alone.
                </InfoBanner>
              </div>
            ) : null}

            {loading ? (
              <LoadingBlock label="Running report…" />
            ) : viewMode === 'chart' && chartData ? (
              <div className="chart-container" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {Object.entries(chartData).map(([key, chart]) => (
                  <div key={key} className="chart-card" style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 16 }}>
                    <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>{chart.title}</h4>
                    {chart.type === 'bar' && (
                      <BarChart
                        data={chart.data}
                        xKey={chart.xKey}
                        series={chart.series}
                        formatValue={chart.formatValue}
                        height={280}
                      />
                    )}
                    {chart.type === 'horizontalBars' && (
                      <HorizontalBars
                        items={chart.items}
                        formatValue={chart.formatValue}
                      />
                    )}
                    {(!chart.data?.length && chart.type === 'bar') || (!chart.items?.length && chart.type === 'horizontalBars') ? (
                      <div className="empty-state" style={{ padding: '34px 12px', textAlign: 'center', color: 'var(--muted)' }}>
                        <b>Insufficient data for chart</b>
                        <p>Charts require numeric data. Run the report with a wider date range or different filters.</p>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : filteredRows.length ? (
              <>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        {columns.map((column) => (
                          <th key={column}>{titleCase(column)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((row, index) => (
                        <tr key={index}>
                          {columns.map((column) => (
                            <td key={column}>{formatCell(column, row[column])}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
                {(Object.keys(rules).length > 0) && (
                  <div className="rules-note">
                    <b>Report rules: </b>
                    {Object.entries(rules)
                      .map(([key, value]) => `${titleCase(key)}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
                      .join(' · ')}
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                icon={FileBarChart}
                title="No rows in this report"
                description={
                  idleUnsupported
                    ? 'Ignition data is required to distinguish idle from stopped vehicles.'
                    : 'No stored telemetry matches the selected report, vehicle, device, time range, and data source.'
                }
              />
            )}
          </Card>

          <Card title="Data provenance" subtitle="What this report does and does not claim">
            <div className="kv-list">
              <div className="kv-row">
                <span>Source</span>
                <b>Persisted location history table</b>
              </div>
              <div className="kv-row">
                <span>Generation</span>
                <b>On request; no cached figures</b>
              </div>
              <div className="kv-row">
                <span>Simulation handling</span>
                <b>Preserved from the simulator flag — never relabelled as hardware data</b>
              </div>
              <div className="kv-row">
                <span>Hardware capability</span>
                <b>Receiver GNSS/NavIC support remains unverified</b>
              </div>
              <div className="kv-row">
                <span>Report catalogue</span>
                <b>{REPORT_CATALOG.flatMap((group) => group.items).length} report types</b>
              </div>
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <FileText size={14} className="muted" />
              <span className="small muted">CSV export applies the same filters and is capped at 5,000 rows by the API.</span>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
