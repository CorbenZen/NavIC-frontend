/* Dashboard fleet table and vehicle detail panel. Data comes from FleetContext; admin health counts come from its role-guarded summary request. */
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Crosshair, RefreshCw, Truck, UserRound, AlertTriangle, WifiOff, Route, Cpu, ShieldAlert } from 'lucide-react';
import { useFleet } from '@react/hooks/useFleet';
import { DATA_SOURCE_OPTIONS, DATA_SOURCE_LABELS, rowDataSource, matchesDataSource, SearchInput } from '../forms';
import { fmtSpeed, timeAgo } from '@react/utils/format';
import { Badge, StatusBadge } from '../common';

const STATUS_FILTERS = [
  ['all', 'ALL', 'all'],
  ['on_move', 'ON MOVE', 'on_move'],
  ['stopped', 'STOPPED', 'stopped'],
  ['idle', 'IDLE', 'idle'],
  ['out_of_network', 'OUT OF N/W', 'out_of_network'],
  ['toing', 'TOING', 'toing'],
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const DATA_SOURCE_FILTERS = DATA_SOURCE_OPTIONS.map((option) => [option.value, option.label]);

function valueOrNA(value) {
  return value === null || value === undefined || String(value).trim() === '' ? 'Not available' : value;
}

function Detail({ label, value }) {
  return <div className="fleet-detail-line"><span>{label}</span><b>{valueOrNA(value)}</b></div>;
}

function VehicleStatus({ status, statusKey }) {
  return <StatusBadge status={status || 'Out Of N/w'} statusKey={statusKey || 'out_of_network'} />;
}

function AttentionItem({ icon: Icon, label, description, action, actionLabel, badge }) {
  return (
    <div className="attention-item">
      <Icon className="attention-icon" />
      <div className="attention-content">
        <span className="attention-label">{label}</span>
        <span className="attention-description">{description}</span>
      </div>
      {badge && <Badge tone="warning">{badge}</Badge>}
      {action && (
        <button type="button" className="btn btn-sm btn-ghost attention-action" onClick={action}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function HygieneItem({ icon: Icon, label, description, count, action, actionLabel }) {
  return (
    <div className="hygiene-item">
      <Icon className="hygiene-icon" />
      <div className="hygiene-content">
        <span className="hygiene-label">{label}</span>
        <span className="hygiene-description">{description}</span>
      </div>
      {count > 0 && <Badge tone="info">{count}</Badge>}
      {action && (
        <button type="button" className="btn btn-sm btn-ghost hygiene-action" onClick={action}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function FleetDashboard({ navigate }) {
  const { vehicles, vehicleStats, loading, refreshing, refresh, error, dataSource, setDataSource, user, adminDashboardSummary } = useFleet();
  const isAdmin = user?.role === 'admin';
  const [selectedId, setSelectedId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);
  const [showAttention, setShowAttention] = useState(true);
  const [showHygiene, setShowHygiene] = useState(true);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return vehicles.filter((row) => {
      if (statusFilter !== 'all' && row.status_key !== statusFilter) return false;
      if (!matchesDataSource(row, dataSource)) return false;
      if (!needle) return true;
      return [row.registration_number, row.vehicle_name, row.name, row.vehicle_id, row.driver_name, row.driver_phone, row.imei_no, row.device_id]
        .some((item) => item != null && String(item).toLowerCase().includes(needle));
    });
  }, [vehicles, statusFilter, query, dataSource]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const displayPage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(displayPage * pageSize, (displayPage + 1) * pageSize);
  const selected = vehicles.find((row) => row.id === selectedId) || vehicles[0] || null;
  const start = filtered.length ? displayPage * pageSize + 1 : 0;
  const end = Math.min(filtered.length, (displayPage + 1) * pageSize);

  function track(row) {
    const vehicle = row.device_id || row.id;
    navigate(`/tracking?vehicle=${encodeURIComponent(vehicle)}`);
  }

  // Admin panel rows are built from the admin-only counts endpoint, never from general fleet lists.
  const attentionItems = useMemo(() => {
    const details = {
      'offline-devices': [WifiOff, 'Devices offline', 'device', 'devices with no TCP session', 'View devices'],
      'stale-telemetry': [AlertTriangle, 'Stale telemetry', 'device', 'devices with stale telemetry', 'View devices'],
      'unread-alerts': [ShieldAlert, 'Unread alerts', 'alert', 'unread alerts', 'View alerts'],
      'vehicles-no-device': [Cpu, 'Vehicles without device', 'vehicle', 'not assigned a tracking device', 'View vehicles'],
      'vehicles-no-driver': [UserRound, 'Vehicles without driver', 'vehicle', 'not assigned a driver', 'View vehicles'],
      'vehicles-no-route': [Route, 'Vehicles without route', 'vehicle', 'not assigned a route', 'View vehicles'],
    };
    return (adminDashboardSummary?.attention || []).filter((row) => row.count > 0 && details[row.key]).map((row) => {
      const [icon, label, noun, description, actionLabel] = details[row.key];
      return { id: row.key, icon, label, description: `${row.count} ${noun}${row.count === 1 ? '' : 's'} ${description}`, action: () => navigate(row.target), actionLabel, badge: row.count > 99 ? '99+' : row.count };
    });
  }, [adminDashboardSummary, navigate]);

  const hygieneItems = useMemo(() => {
    const details = {
      'vehicles-no-device': [Cpu, 'Vehicle without device', 'A vehicle record exists but no tracking device is assigned', 'Fix'],
      'multiple-driver-vehicles': [UserRound, 'Driver assigned to multiple vehicles', 'Drivers linked to more than one vehicle', 'Review'],
      'test-like-vehicles': [AlertTriangle, 'Possible test/demo records', 'Vehicles with test-like identifiers', 'Review'],
      'vehicles-no-route': [Route, 'Vehicle without route', 'Vehicles not assigned a route', 'Fix'],
    };
    return (adminDashboardSummary?.hygiene || []).filter((row) => row.count > 0 && details[row.key]).map((row) => {
      const [icon, label, description, actionLabel] = details[row.key];
      return { icon, label, description, count: row.count, action: () => navigate(row.target), actionLabel };
    });
  }, [adminDashboardSummary, navigate]);

  return <section className="fleet-dashboard" aria-label="Vehicle fleet dashboard">
    <div className="fleet-dashboard-main">
      <div className="fleet-status-filters" role="group" aria-label="Filter vehicles by status">
        {STATUS_FILTERS.map(([key, label, countKey]) => {
          const count = key === 'all' ? vehicleStats?.all : vehicleStats?.[countKey];
          const empty = key !== 'all' && Number(count) === 0;
          return <button key={key} type="button" className={`fleet-status-filter ${key} ${statusFilter === key ? 'selected' : ''} ${empty ? 'empty' : ''}`} aria-pressed={statusFilter === key} onClick={() => { setPage(0); setStatusFilter(key); }}>
            <span>{label}</span><b>{Number.isFinite(Number(count)) ? count : '—'}</b>
          </button>;
        })}
      </div>

      {/* Admin-only summary is fetched from a role-guarded endpoint. */}
      {isAdmin && <>
      <section className="card needs-attention-panel" aria-labelledby="attention-title">
        <header className="attention-header">
          <h3 id="attention-title" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <AlertTriangle size={16} /> Needs attention
            <button type="button" className="btn btn-xs btn-ghost" onClick={() => setShowAttention(!showAttention)} aria-expanded={showAttention} aria-controls="attention-list" style={{ marginLeft: 'auto' }}>
              {showAttention ? 'Hide' : 'Show'} ({attentionItems.length})
            </button>
          </h3>
        </header>
        {showAttention && (
          <div id="attention-list" className="attention-list" role="list">
            {attentionItems.length ? (
              attentionItems.map((item) => (
                <AttentionItem
                  key={item.id}
                  icon={item.icon}
                  label={item.label}
                  description={item.description}
                  action={item.action}
                  actionLabel={item.actionLabel}
                  badge={item.badge}
                />
              ))
            ) : (
              <div className="attention-empty">Nothing needs attention</div>
            )}
          </div>
        )}
      </section>

      {/* Fleet Hygiene Panel */}
      <section className="card fleet-hygiene-panel" aria-labelledby="hygiene-title">
        <header className="attention-header">
          <h3 id="hygiene-title" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <ShieldAlert size={16} /> Fleet hygiene
            <button type="button" className="btn btn-xs btn-ghost" onClick={() => setShowHygiene(!showHygiene)} aria-expanded={showHygiene} aria-controls="hygiene-list" style={{ marginLeft: 'auto' }}>
              {showHygiene ? 'Hide' : 'Show'} ({hygieneItems.length})
            </button>
          </h3>
        </header>
        {showHygiene && (
          <div id="hygiene-list" className="hygiene-list" role="list">
            {hygieneItems.length ? (
              hygieneItems.map((item, index) => (
                <HygieneItem
                  key={index}
                  icon={item.icon}
                  label={item.label}
                  description={item.description}
                  count={item.count}
                  action={item.action}
                  actionLabel={item.actionLabel}
                />
              ))
            ) : (
              <div className="attention-empty">No hygiene issues detected</div>
            )}
          </div>
        )}
      </section>
      </>}

      <section className="card fleet-table-card" aria-labelledby="fleet-table-title">
        <header className="fleet-table-heading">
          <div><h2 id="fleet-table-title">Fleet vehicles</h2><p>{start}–{end} of {filtered.length} result{filtered.length === 1 ? '' : 's'}</p></div>
          <div className="fleet-table-controls">
            <SearchInput value={query} onChange={(value) => { setPage(0); setQuery(value); }} placeholder="Search vehicle, driver or IMEI" ariaLabel="Search vehicles" className="fleet-search" />
            <label className="fleet-page-size">Rows <select value={pageSize} onChange={(event) => { setPage(0); setPageSize(Number(event.target.value)); }}>
              {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
            </select></label>
            <select className="input data-source-filter" value={dataSource} onChange={(e) => setDataSource(e.target.value)} aria-label="Filter by data source">
              {DATA_SOURCE_FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <button type="button" className="btn btn-sm" onClick={refresh} disabled={refreshing} aria-label="Refresh vehicle data"><RefreshCw className={refreshing ? 'spin-icon' : undefined} /> Refresh</button>
          </div>
        </header>
        <div className="fleet-table-scroll">
          <table className="data-table fleet-table">
            <thead><tr><th>S#</th><th>Vehicle</th><th>Driver, Ph.No.</th><th>Date Time</th><th className="num">Speed</th><th>Status</th><th>Track</th></tr></thead>
            <tbody>
              {pageRows.map((row, index) => <tr key={row.id} className={selectedId === row.id ? 'selected' : ''} tabIndex={0} aria-label={`Select ${row.registration_number}`} onClick={() => setSelectedId(row.id)} onKeyDown={(event) => { if (event.target.tagName !== 'BUTTON' && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setSelectedId(row.id); } }}>
                <td>{page * pageSize + index + 1}</td>
                <td><span className="primary">{valueOrNA(row.registration_number)}</span><span className="secondary">{valueOrNA(row.vehicle_name || row.name)}</span></td>
                <td><span className="primary">{valueOrNA(row.driver_name)}</span><span className="secondary">{valueOrNA(row.driver_phone)}</span></td>
                <td><span className="primary">{row.last_seen ? new Date(row.last_seen).toLocaleString() : 'No telemetry'}</span><span className="secondary">{row.last_seen ? timeAgo(row.last_seen) : '—'}</span></td>
                <td className="num">{fmtSpeed(row.speed)}</td>
                <td><VehicleStatus status={row.status} statusKey={row.status_key} /></td>
                <td><button type="button" className="btn btn-sm fleet-track-button" onClick={(event) => { event.stopPropagation(); track(row); }}><Crosshair size={14} /> Track</button></td>
              </tr>)}
              {!pageRows.length && <tr><td colSpan={7}><div className="fleet-table-empty">{loading ? 'Loading registered vehicles…' : error || 'No vehicles match this filter.'}</div></td></tr>}
            </tbody>
          </table>
        </div>
        <footer className="fleet-pagination"><span>Showing {start}–{end} of {filtered.length}</span><div><button type="button" className="btn btn-sm" disabled={displayPage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} aria-label="Previous page"><ChevronLeft size={16} /> Previous</button><span>Page {displayPage + 1} of {totalPages}</span><button type="button" className="btn btn-sm" disabled={displayPage + 1 >= totalPages} onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))} aria-label="Next page">Next <ChevronRight size={16} /></button></div></footer>
      </section>
    </div>

    <aside className="card fleet-details-panel" aria-label="Selected vehicle details">
      {selected ? <>
        <div className="fleet-details-head"><div><span>SELECTED VEHICLE</span><h2>{valueOrNA(selected.registration_number)}</h2><small>{valueOrNA(selected.vehicle_name || selected.name)}</small></div><VehicleStatus status={selected.status} statusKey={selected.status_key} /></div>
        <div className="fleet-live-highlight"><div><span>Current speed</span><b>{fmtSpeed(selected.speed)}</b></div><div><span>Last seen</span><b>{selected.last_seen ? timeAgo(selected.last_seen) : 'No telemetry'}</b></div></div>
        <section className="fleet-detail-card"><h3><Truck size={16} /> Vehicle</h3><Detail label="Registration" value={selected.registration_number} /><Detail label="Vehicle name" value={selected.vehicle_name || selected.name} /><Detail label="Make" value={selected.make} /><Detail label="Model" value={selected.model} /><Detail label="Color" value={selected.color} /></section>
        <section className="fleet-detail-card"><h3>Tracking device</h3><Detail label="Device name" value={selected.device_name} /><Detail label="Device model" value={selected.device_model} /><Detail label="IMEI" value={selected.imei_no} /><Detail label="Source" value={DATA_SOURCE_LABELS[rowDataSource(selected)]} /></section>
        <section className="fleet-detail-card"><h3><UserRound size={16} /> Driver</h3><Detail label="Name" value={selected.driver_name === 'Unassigned' ? null : selected.driver_name} /><Detail label="Phone" value={selected.driver_phone} /><Detail label="Email" value={selected.driver_email} /></section>
        <section className="fleet-detail-card"><h3>Live information</h3><Detail label="Ignition" value={selected.ignition_available ? (selected.ignition ? 'On' : 'Off') : 'Not reported'} /><Detail label="Coordinates" value={selected.latitude != null && selected.longitude != null ? `${Number(selected.latitude).toFixed(5)}, ${Number(selected.longitude).toFixed(5)}` : null} /><Detail label="Telemetry time" value={selected.last_seen ? new Date(selected.last_seen).toLocaleString() : null} /></section>
        <button type="button" className="btn btn-primary fleet-details-track" onClick={() => track(selected)}><Crosshair size={16} /> Track this vehicle</button>
      </> : <div className="fleet-detail-empty"><Truck size={28} /><b>Select a vehicle</b><p>Choose a fleet row to inspect its vehicle, device, driver, and live telemetry details.</p></div>}
    </aside>
  </section>;
}
