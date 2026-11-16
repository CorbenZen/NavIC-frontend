import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  BusFront,
  Clock,
  Gauge,
  Map,
  Navigation,
  RefreshCw,
  WifiOff,
} from 'lucide-react';
import { BarChart, DonutChart } from '../../components/charts';
import { FleetDashboard } from '../../components/cards';
import { FleetMap } from '@leaflet/components';
import { Badge, Card, EmptyState, PageHeader, StatusBadge } from '../../components/common';
import { StatCard } from '../../components/cards';
import { ErrorBanner, LoadingBlock } from '../../components/feedback';
import { useFleet } from '@react/hooks/useFleet';
import { fmtDistance, fmtNumber, fmtSpeed, STATUS_COLORS, statusMeta, timeAgo } from '@react/utils/format';

const ALERT_TONE = {
  overspeed: 'danger',
  device_offline: 'warning',
  geofence_entry: 'info',
  geofence_exit: 'neutral',
};

export function Overview({ navigate }) {
  const { summary, tracking, loading, error, refresh, refreshing } = useFleet();

  if (loading && !summary) {
    return (
      <>
        <PageHeader eyebrow="Operations" title="Dashboard" subtitle="Live operational picture from persisted telemetry" />
        <Card>
          <LoadingBlock label="Loading fleet data…" />
        </Card>
      </>
    );
  }

  const fleet = summary?.fleet || { total: 0, moving: 0, stopped: 0, idle: 0, offline: 0, no_data: 0 };
  const activity = summary?.activity || [];
  const alerts = summary?.alerts?.recent || [];
  const recent = summary?.recent || [];
  const devices = summary?.devices || {};
  const simulation = summary?.simulation || {};
  const unavailable = (fleet.offline || 0) + (fleet.no_data || 0);
  const totalFixes = activity.reduce((sum, day) => sum + (Number(day.fixes) || 0), 0);
  const totalDistance = activity.reduce((sum, day) => sum + (Number(day.distance_km) || 0), 0);
  const hasSimulation = Number(simulation.simulated_fixes || 0) > 0 || Number(simulation.simulated_devices || 0) > 0;

  const statusSegments = [
    { label: 'On Move', value: fleet.on_move ?? fleet.moving ?? 0, color: STATUS_COLORS.on_move },
    { label: 'Stopped', value: fleet.stopped || 0, color: STATUS_COLORS.stopped },
    { label: 'Idle', value: fleet.idle || 0, color: STATUS_COLORS.idle },
    { label: 'Out Of N/w', value: unavailable, color: STATUS_COLORS.out_of_network },
    { label: 'Toing', value: fleet.toing || 0, color: STATUS_COLORS.toing },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Dashboard"
        subtitle="Every value below is calculated from persisted telemetry in the CBTMS database. Positions refresh over the live WebSocket link."
        actions={
          <>
            <button type="button" className="btn" onClick={refresh} disabled={refreshing}>
              <RefreshCw style={refreshing ? { animation: 'spin 0.9s linear infinite' } : undefined} />
              Refresh
            </button>
            <button type="button" className="btn btn-primary" onClick={() => navigate('/tracking')}>
              <Map /> Open live map
            </button>
          </>
        }
      />

      {error ? <ErrorBanner message={error} onRetry={refresh} resource="dashboard" /> : null}

      {hasSimulation ? (
        <div className="warn-banner">
          <AlertTriangle />
          <div>
            <b>Simulation data is present.</b> {simulation.simulated_devices || 0} registered device(s) and {simulation.simulated_fixes || 0} latest
            fix(es) are simulator-backed. Simulation output is labelled <span className="mono">simulated: true</span> and is not hardware data.
          </div>
        </div>
      ) : null}

      <FleetDashboard navigate={navigate} />

      <div className="stat-grid">
        <StatCard
          label="Fleet vehicles"
          value={fmtNumber(fleet.total)}
          hint={`${devices.assigned || 0} device assignment(s)`}
          icon={BusFront}
          tone="brand"
        />
        <StatCard label="Moving now" value={fmtNumber(fleet.on_move ?? fleet.moving)} hint="Fresh telemetry, speed above threshold" icon={Navigation} tone="on-move" />
        <StatCard label="Idle / stopped" value={fmtNumber((fleet.idle || 0) + (fleet.stopped || 0))} hint={`${fleet.idle || 0} idle · ${fleet.stopped || 0} stopped`} icon={Gauge} tone="amber" />
        <StatCard label="Offline / no data" value={fmtNumber(unavailable)} hint={`Stale after ${Math.round((summary?.offline_after_seconds || 0) / 60)} minutes`} icon={WifiOff} tone="slate" />
        <StatCard
          label="Unread alerts"
          value={fmtNumber(summary?.alerts?.unread || 0)}
          hint="Overspeed, offline and geofence events"
          icon={Bell}
          tone={(summary?.alerts?.unread || 0) > 0 ? 'danger' : 'slate'}
        />
      </div>

      <div className="grid-2">
        <Card
          title="Seven-day activity"
          subtitle="Recorded fixes and distinct vehicles per calendar day"
          actions={<Badge tone="neutral">{fmtNumber(totalFixes)} fixes</Badge>}
        >
          <BarChart
            data={activity}
            xKey="date"
            height={230}
            series={[
              { key: 'fixes', label: 'Fixes', color: '#0d9488' },
              { key: 'vehicles', label: 'Vehicles', color: '#60a5fa' },
            ]}
            formatValue={(value) => fmtNumber(value)}
            emptyLabel="No telemetry has been recorded in the last seven days"
          />
          <div className="row between" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--line)' }}>
            <span className="small muted">Distance measured across the week</span>
            <b className="small">{fmtDistance(totalDistance)}</b>
          </div>
        </Card>

        <Card title="Fleet status" subtitle="Based on the latest persisted fix per vehicle">
          <DonutChart segments={statusSegments} centerLabel="Vehicles" centerValue={fleet.total || 0} />
          <div className="kv-list" style={{ marginTop: 14, borderTop: '1px solid var(--line)' }}>
            <div className="kv-row">
              <span>Devices with a fresh fix</span>
              <b>
                {devices.telemetry_fresh || 0} / {devices.total || 0}
              </b>
            </div>
            <div className="kv-row">
              <span>Devices in a live TCP session</span>
              <b>{devices.tcp_online || 0}</b>
            </div>
            <div className="kv-row">
              <span>Inactive device registry entries</span>
              <b>{devices.inactive || 0}</b>
            </div>
            <div className="kv-row">
              <span>Active drivers</span>
              <b>
                {summary?.drivers?.active || 0} / {summary?.drivers?.total || 0}
              </b>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <Card
          title="Live positions"
          subtitle={`${tracking.filter((row) => Number.isFinite(Number(row.latitude))).length} vehicle(s) with a usable position`}
          actions={
            <button type="button" className="btn btn-sm" onClick={() => navigate('/tracking')}>
              Full map <ArrowRight />
            </button>
          }
          bodyClassName="tight"
        >
          <FleetMap vehicles={tracking} height={330} showLegend emptyNote={tracking.length ? null : 'No active tracking devices are registered yet.'} />
        </Card>

        <Card
          title="Recent alerts"
          subtitle="Newest events across the fleet"
          actions={
            <button type="button" className="btn btn-sm" onClick={() => navigate('/alerts')}>
              All alerts <ArrowRight />
            </button>
          }
        >
          {alerts.length ? (
            <div className="alert-list">
              {alerts.map((alert) => (
                <div className={`alert-item ${alert.is_read ? '' : 'unread'}`} key={alert.id}>
                  <div className={`alert-icon ${ALERT_TONE[alert.event_type] || 'neutral'}`}>
                    <Bell />
                  </div>
                  <div className="alert-main">
                    <b>{alert.event_type?.replaceAll('_', ' ')}</b>
                    <p>{alert.message}</p>
                    <div className="alert-meta">
                      <span>{timeAgo(alert.created_at)}</span>
                      {alert.device_id ? <span className="mono">{alert.device_id}</span> : null}
                      {alert.is_read ? null : <Badge tone="warning">Unread</Badge>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No alerts recorded" description="Overspeed, device-offline and geofence transitions will appear here when they occur." />
          )}
        </Card>
      </div>

      <Card
        title="Recent vehicle activity"
        subtitle="Latest state per registered vehicle"
        actions={<Badge tone="neutral">Generated {timeAgo(summary?.generated_at)}</Badge>}
        flush
        style={{ marginTop: 16 }}
      >
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Driver</th>
                <th>Route</th>
                <th>Status</th>
                <th className="num">Speed</th>
                <th>Last fix</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {recent.length ? (
                recent.map((vehicle) => (
                  <tr key={vehicle.bus_id}>
                    <td>
                      <span className="primary">{vehicle.registration_number}</span>
                      <span className="secondary">{vehicle.vehicle_id}</span>
                    </td>
                    <td>{vehicle.driver_name || 'Unassigned'}</td>
                    <td>{vehicle.route_name || 'Unassigned'}</td>
                    <td>
                      <StatusBadge status={vehicle.status} statusKey={vehicle.status_key} />
                    </td>
                    <td className="num">{fmtSpeed(vehicle.speed)}</td>
                    <td>
                      <span className="primary" style={{ fontWeight: 500 }}>
                        {vehicle.last_seen ? timeAgo(vehicle.last_seen) : 'No data'}
                      </span>
                      <span className="secondary">{vehicle.device_id || 'No device'}</span>
                    </td>
                    <td className="actions">
                      <button type="button" className="btn btn-sm" onClick={() => navigate(`/tracking?vehicle=${encodeURIComponent(vehicle.device_id || vehicle.bus_id)}`)}>
                        Track
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={BusFront}
                      title="No vehicles registered"
                      description="Add vehicles, drivers and devices to start building the fleet."
                      action={
                        <button type="button" className="btn btn-sm btn-primary" onClick={() => navigate('/vehicles')}>
                          Manage vehicles
                        </button>
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid-3" style={{ marginTop: 16 }}>
        <Card title="Data freshness" subtitle="Latest observation per status">
          <div className="mini-list">
            <div className="mini-row">
              <div className="timeline-dot">
                <Clock />
              </div>
              <div className="mini-row-main">
                <b>{summary?.generated_at ? timeAgo(summary.generated_at) : '—'}</b>
                <small>Dashboard snapshot generated</small>
              </div>
            </div>
            <div className="mini-row">
              <div className="timeline-dot">
                <Activity />
              </div>
              <div className="mini-row-main">
                <b>{fmtNumber(devices.telemetry_fresh || 0)} fresh device(s)</b>
                <small>Telemetry newer than the offline threshold</small>
              </div>
            </div>
            <div className="mini-row">
              <div className="timeline-dot">
                <Navigation />
              </div>
              <div className="mini-row-main">
                <b>{fmtNumber(devices.tcp_online || 0)} TCP session(s)</b>
                <small>Live receiver connections, independent of fix freshness</small>
              </div>
            </div>
          </div>
        </Card>
        <Card title="Route coverage" subtitle="Assignments stored in the registry">
          <div className="kv-list">
            <div className="kv-row">
              <span>Configured routes</span>
              <b>{summary?.routes?.total || 0}</b>
            </div>
            <div className="kv-row">
              <span>Vehicles with a route</span>
              <b>{summary?.routes?.assigned_vehicles || 0}</b>
            </div>
            <div className="kv-row">
              <span>Devices with a vehicle</span>
              <b>{devices.assigned || 0}</b>
            </div>
            <div className="kv-row">
              <span>Simulated devices</span>
              <b>{devices.simulated || 0}</b>
            </div>
          </div>
        </Card>
        <Card title="Operational shortcuts" subtitle="Jump to the management area">
          <div className="stack" style={{ gap: 8 }}>
            {[
              ['Vehicles', '/vehicles'],
              ['Drivers', '/drivers'],
              ['Routes', '/routes'],
              ['Devices', '/devices'],
              ['Reports', '/reports'],
            ].map(([label, target]) => (
              <button type="button" key={target} className="btn" style={{ justifyContent: 'space-between' }} onClick={() => navigate(target)}>
                {label} <ArrowRight />
              </button>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
