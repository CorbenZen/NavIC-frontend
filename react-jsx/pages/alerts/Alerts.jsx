import { Bell, CheckCheck, ChevronDown, Gauge, MapPin, RefreshCw, WifiOff } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@services/api';
import { Badge, Card, EmptyState, PageHeader } from '../../components/common';
import { StatCard } from '../../components/cards';
import { ErrorBanner, LoadingBlock, useToast } from '../../components/feedback';
import { ALERT_META } from '../../utils/config';
import { useFleet } from '@react/hooks/useFleet';
import { isManagementRole } from '../../utils/navigation';
import { fmtDateTime, timeAgo } from '@react/utils/format';

const ICONS = {
  overspeed: Gauge,
  device_offline: WifiOff,
  geofence_entry: MapPin,
  geofence_exit: MapPin,
};

const STATE_LABELS = {
  open: 'Open',
  resolved: 'Resolved',
};

const STATE_TONES = {
  open: 'danger',
  resolved: 'success',
};

export function Alerts() {
  const { refresh, user } = useFleet();
  const canManage = isManagementRole(user?.role);
  const toast = useToast();
  
  // Incident state
  const [incidents, setIncidents] = useState([]);
  const [unreadIncidents, setUnreadIncidents] = useState(0);
  const [stateFilter, setStateFilter] = useState(''); // open, resolved, or all
  const [eventType, setEventType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [markingAll, setMarkingAll] = useState(false);
  const [tick, setTick] = useState(0);
  const [expandedIncident, setExpandedIncident] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (stateFilter) params.set('state', stateFilter);
      if (eventType) params.set('event_type', eventType);
      const result = await api.alertIncidents(`?${params.toString()}`);
      setIncidents(Array.isArray(result?.incidents) ? result.incidents : []);
      setUnreadIncidents(Number(result?.unread_count || 0));
    } catch (loadError) {
      setIncidents([]);
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }, [stateFilter, eventType]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => load());
    return () => cancelAnimationFrame(frame);
  }, [load, tick]);

  const markIncidentRead = async (incident) => {
    try {
      await api.markIncidentRead(incident.id);
      setIncidents((current) => 
        current.map((row) => (row.id === incident.id ? { ...row, is_read: true } : row))
          .filter((row) => !(stateFilter === 'open' && row.state === 'resolved'))
      );
      setUnreadIncidents((current) => Math.max(0, current - (incident.is_read ? 0 : 1)));
      toast.success('Incident marked as read.');
      refresh();
    } catch (markError) {
      toast.error(markError.message || 'Could not update the incident.');
    }
  };

  const markAll = async () => {
    setMarkingAll(true);
    try {
      const result = await api.markAllIncidentsRead();
      toast.success(`${result?.incidents_updated ?? 0} incident(s) and ${result?.alerts_updated ?? 0} alert(s) marked as read.`);
      setUnreadIncidents(0);
      setTick((value) => value + 1);
      refresh();
    } catch (markError) {
      toast.error(markError.message || 'Could not mark all incidents as read.');
    } finally {
      setMarkingAll(false);
    }
  };

  const toggleExpand = (incidentId) => {
    setExpandedIncident((prev) => (prev === incidentId ? null : incidentId));
  };

  const getDuration = (incident) => {
    if (!incident.opened_at) return '—';
    const opened = new Date(incident.opened_at);
    const closed = incident.resolved_at ? new Date(incident.resolved_at) : new Date();
    const diffMs = closed - opened;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getSinceText = (incident) => {
    if (!incident.opened_at) return '—';
    const opened = new Date(incident.opened_at);
    const now = new Date();
    const diffMs = now - opened;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m ago`;
    return `${minutes}m ago`;
  };

  return (
    <>
      <PageHeader
        eyebrow="Insights"
        title="Alerts"
        subtitle="Incidents group related alerts (e.g., a device offline outage). Open = ongoing, Resolved = telemetry resumed."
        actions={
          <>
            <button type="button" className="btn" onClick={load} disabled={loading}>
              <RefreshCw style={loading ? { animation: 'spin 0.9s linear infinite' } : undefined} /> Refresh
            </button>
            {canManage ? (
              <button type="button" className="btn btn-primary" onClick={markAll} disabled={markingAll || unreadIncidents === 0}>
                <CheckCheck /> Mark all read
              </button>
            ) : null}
          </>
        }
      />

      {error ? <ErrorBanner message={error} onRetry={load} resource="alerts" /> : null}

      <div className="stat-grid">
        <StatCard label="Unread incidents" value={unreadIncidents} hint="Ongoing outages needing attention" icon={Bell} tone={unreadIncidents ? 'danger' : 'slate'} />
        <StatCard label="Incidents loaded" value={incidents.length} hint="Newest 100 matching the filters" icon={Bell} tone="blue" />
        <StatCard
          label="Open"
          value={incidents.filter((i) => i.state === 'open').length}
          hint="Ongoing outages"
          icon={WifiOff}
          tone="amber"
        />
        <StatCard
          label="Resolved"
          value={incidents.filter((i) => i.state === 'resolved').length}
          hint="Outages where telemetry resumed"
          icon={Gauge}
          tone="violet"
        />
      </div>

      <Card
        title="Alert incidents"
        subtitle="Each incident represents one continuous outage or event. Click to expand and see individual alerts."
        actions={
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <select className="input" style={{ width: 'auto', minHeight: 32, padding: '4px 8px' }} value={stateFilter} onChange={(event) => setStateFilter(event.target.value)} aria-label="Filter by state">
              <option value="">All states</option>
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
            </select>
            <select className="input" style={{ width: 'auto', minHeight: 32, padding: '4px 8px' }} value={eventType} onChange={(event) => setEventType(event.target.value)} aria-label="Filter by alert type">
              <option value="">All alert types</option>
              {Object.entries(ALERT_META).map(([value, meta]) => (
                <option key={value} value={value}>
                  {meta.label}
                </option>
              ))}
            </select>
          </div>
        }
        flush
      >
        {loading ? (
          <LoadingBlock label="Loading incidents…" />
        ) : incidents.length ? (
          <div style={{ padding: 14 }}>
            <div className="alert-list">
              {incidents.map((incident) => {
                const meta = ALERT_META[incident.event_type] || { label: incident.event_type?.replaceAll('_', ' '), tone: 'neutral' };
                const Icon = ICONS[incident.event_type] || Bell;
                const isExpanded = expandedIncident === incident.id;
                const duration = getDuration(incident);
                const sinceText = getSinceText(incident);
                const stateLabel = STATE_LABELS[incident.state] || incident.state;
                const stateTone = STATE_TONES[incident.state] || 'neutral';

                return (
                  <article className={`alert-item incident ${incident.is_read ? '' : 'unread'} ${isExpanded ? 'expanded' : ''}`} key={incident.id}>
                    <div className="incident-header" onClick={() => toggleExpand(incident.id)} style={{ cursor: 'pointer' }}>
                      <div className={`alert-icon ${meta.tone}`}>
                        <Icon />
                      </div>
                      <div className="incident-main" style={{ flex: 1, minWidth: 0 }}>
                        <div className="row between" style={{ alignItems: 'flex-start', gap: 10 }}>
                          <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                            <b>{meta.label}</b>
                            <Badge tone={stateTone}>{stateLabel}</Badge>
                            {incident.is_read ? <Badge tone="neutral">Read</Badge> : <Badge tone="warning">Unread</Badge>}
                          </div>
                          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                            <span className="mono small">{incident.device_id}</span>
                            <span className="small">{duration}</span>
                            <span className="small muted">{sinceText}</span>
                            <ChevronDown className={isExpanded ? 'rotated' : ''} style={{ transition: 'transform 0.2s' }} />
                          </div>
                        </div>
                        <p style={{ marginTop: 8, color: 'var(--muted)', fontSize: 13 }}>{incident.message}</p>
                      </div>
                      {canManage && !incident.is_read && incident.state === 'open' ? (
                        <button type="button" className="btn btn-sm" onClick={(e) => { e.stopPropagation(); markIncidentRead(incident); }}>
                          Mark read
                        </button>
                      ) : null}
                    </div>

                    {isExpanded && (
                      <div className="incident-details" style={{ padding: '16px 16px 16px 56px', borderTop: '1px solid var(--line)', background: 'var(--surface-soft)' }}>
                        <div className="row" style={{ gap: 16, flexWrap: 'wrap', marginBottom: 12, fontSize: 12, color: 'var(--muted)' }}>
                          <span><b>Incident ID:</b> {incident.id}</span>
                          <span><b>Event type:</b> {incident.event_type}</span>
                          <span><b>Opened:</b> {fmtDateTime(incident.opened_at)}</span>
                          {incident.resolved_at ? <span><b>Resolved:</b> {fmtDateTime(incident.resolved_at)}</span> : <span className="text-warning"><b>Still open</b></span>}
                          {incident.last_seen_at ? <span><b>Last telemetry:</b> {fmtDateTime(incident.last_seen_at)}</span> : null}
                          <span><b>Alert count:</b> {incident.alert_count}</span>
                        </div>
                        <div className="incident-alerts">
                          <h4 style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--ink-soft)' }}>Individual alerts ({incident.alert_count})</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {incident.alerts && incident.alerts.map((alert) => (
                              <div key={alert.id} className={`incident-alert ${alert.is_read ? '' : 'unread'}`} style={{ padding: '8px 12px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }}>
                                <div className="row between" style={{ gap: 10 }}>
                                  <span className="small mono">{fmtDateTime(alert.created_at)}</span>
                                  <span className="small">{timeAgo(alert.created_at)}</span>
                                  {alert.is_read ? <Badge tone="neutral" style={{ fontSize: 10 }}>Read</Badge> : <Badge tone="warning" style={{ fontSize: 10 }}>Unread</Badge>}
                                </div>
                                <p className="small" style={{ marginTop: 4, color: 'var(--muted)' }}>{alert.message}</p>
                              </div>
                            ))}
                            {(!incident.alerts || incident.alerts.length === 0) && (
                              <p className="small muted" style={{ padding: 8 }}>Loading alerts…</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        ) : (
          <EmptyState
            icon={Bell}
            title="No incidents match this view"
            description={
              stateFilter || eventType
                ? 'Clear the filters to see the full incident history.'
                : 'Incidents are created when telemetry crosses the configured speed threshold, a device goes offline, or a geofence transition occurs.'
            }
          />
        )}
      </Card>
    </>
  );
}

// Need to add api methods for incidents
import { apiFetch, API_BASE } from '@services/api';

// Add incident methods to api object (this will be merged at runtime)
api.alertIncidents = (params = '') => apiFetch(`/api/alerts/incidents${params}`);
api.getAlertIncident = (id) => apiFetch(`/api/alerts/incidents/${id}`);
api.markIncidentRead = (id) => apiFetch(`/api/alerts/incidents/${id}/read`, { method: 'PATCH' });
api.markAllIncidentsRead = () => apiFetch('/api/alerts/incidents/read-all', { method: 'PATCH' });
