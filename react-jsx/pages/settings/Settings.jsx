import {
  Activity,
  Database,
  FileText,
  Gauge,
  KeyRound,
  RefreshCw,
  Save,
  Server,
  ShieldCheck,
  ToggleLeft,
  UserRound,
  WifiOff,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@services/api';
import { Badge, Card, EmptyState, PageHeader } from '../../components/common';
import { Field } from '../../components/forms';
import { ErrorBanner, InfoBanner, LoadingBlock, useToast } from '../../components/feedback';
import { useFleet } from '@react/hooks/useFleet';
import { fmtDateTime, timeAgo, titleCase } from '@react/utils/format';

export function SettingsPage() {
  const { settings, loading, error, refresh, refreshing } = useFleet();
  const toast = useToast();
  const [form, setForm] = useState({ overspeed: '80', offline: '5', etaEnabled: false });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [meta, setMeta] = useState(null);
  const [me, setMe] = useState(null);
  const [audit, setAudit] = useState([]);
  const [auditError, setAuditError] = useState('');
  const [auditLoading, setAuditLoading] = useState(true);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    setAuditError('');
    try {
      const result = await api.audit('?limit=60');
      setAudit(Array.isArray(result?.audit) ? result.audit : []);
    } catch (auditFailure) {
      setAudit([]);
      setAuditError(auditFailure);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    if (settings) {
      const frame = requestAnimationFrame(() => setForm({
        overspeed: String(settings.overspeed_kmh ?? 80),
        offline: String(settings.device_offline_minutes ?? 5),
        etaEnabled: settings.eta_enabled ?? false,
      }));
      return () => cancelAnimationFrame(frame);
    }
    return undefined;
  }, [settings]);

  useEffect(() => {
    api.meta().then(setMeta).catch(() => {});
    api.me()
      .then((current) => {
        setMe(current);
        if (current?.role === 'admin') loadAudit();
        else setAuditLoading(false);
      })
      .catch(() => setAuditLoading(false));
  }, [loadAudit]);

  const submit = async (event) => {
    event.preventDefault();
    setFormError('');
    const overspeed = Number(form.overspeed);
    const offline = Number(form.offline);
    if (!Number.isFinite(overspeed) || overspeed <= 0 || overspeed > 300) {
      setFormError('Overspeed threshold must be greater than 0 and at most 300 km/h.');
      return;
    }
    if (!Number.isFinite(offline) || offline < 1 || offline > 1440) {
      setFormError('Device offline window must be between 1 and 1,440 minutes.');
      return;
    }
    setSaving(true);
    try {
      const saved = await api.saveSettings({ overspeed_kmh: overspeed, device_offline_minutes: offline, eta_enabled: form.etaEnabled });
      setForm({ overspeed: String(saved.overspeed_kmh), offline: String(saved.device_offline_minutes), etaEnabled: saved.eta_enabled });
      toast.success('Operational settings saved.');
      refresh();
    } catch (saveError) {
      setFormError(saveError.message || 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="System"
        title="Settings"
        subtitle="Operational thresholds used by alert generation and reporting. Changes are audited."
        actions={
          <button type="button" className="btn" onClick={refresh} disabled={refreshing}>
            <RefreshCw style={refreshing ? { animation: 'spin 0.9s linear infinite' } : undefined} /> Refresh
          </button>
        }
      />

      {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}

      <div className="grid-2">
        <Card title="Operational thresholds" subtitle="Applied by the API when processing telemetry and rendering reports">
          {loading && !settings ? (
            <LoadingBlock label="Loading settings…" />
          ) : (
            <form onSubmit={submit} className="stack" style={{ gap: 14 }}>
              {formError ? <div className="form-error">{formError}</div> : null}
              <div className="diag-item">
                <small>
                  <Gauge size={11} style={{ verticalAlign: '-1px', marginRight: 4 }} />
                  Overspeed threshold (km/h)
                </small>
                <input
                  type="number"
                  min="1"
                  max="300"
                  step="0.1"
                  required
                  value={form.overspeed}
                  onChange={(event) => setForm({ ...form, overspeed: event.target.value })}
                  style={{ marginTop: 7, width: '100%', minHeight: 38, padding: '8px 10px', border: '1px solid var(--line-strong)', borderRadius: 8 }}
                />
                <p className="hint" style={{ marginTop: 6 }}>
                  An overspeed alert is created when a fix crosses above this threshold from at or below it.
                </p>
              </div>
              <div className="diag-item">
                <small>
                  <WifiOff size={11} style={{ verticalAlign: '-1px', marginRight: 4 }} />
                  Device offline window (minutes)
                </small>
                <input
                  type="number"
                  min="1"
                  max="1440"
                  step="1"
                  required
                  value={form.offline}
                  onChange={(event) => setForm({ ...form, offline: event.target.value })}
                  style={{ marginTop: 7, width: '100%', minHeight: 38, padding: '8px 10px', border: '1px solid var(--line-strong)', borderRadius: 8 }}
                />
                <p className="hint" style={{ marginTop: 6 }}>
                  Telemetry older than this window is treated as stale for status, freshness and offline alerts.
                </p>
              </div>
              <div className="diag-item">
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <ToggleLeft size={18} style={{ color: form.etaEnabled ? 'var(--brand)' : 'var(--muted)' }} />
                  <div>
                    <small><b>Enable ETA calculations</b></small>
                    <p className="hint" style={{ marginTop: 2 }}>When enabled, estimated arrival times are computed for vehicles on assigned routes. Default is OFF.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.etaEnabled}
                    onChange={(event) => setForm({ ...form, etaEnabled: event.target.checked })}
                    style={{ width: 20, height: 20, accentColor: 'var(--brand)' }}
                  />
                </label>
              </div>
              <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  <Save /> {saving ? 'Saving…' : 'Save settings'}
                </button>
              </div>
            </form>
          )}
        </Card>

        <Card title="Account & deployment" subtitle="Current session and service configuration">
          <div className="kv-list">
            <div className="kv-row">
              <span>Signed-in account</span>
              <b>{me?.username || '—'}</b>
            </div>
            <div className="kv-row">
              <span>Role</span>
              <b>{me?.role ? titleCase(me.role) : '—'}</b>
            </div>
            <div className="kv-row">
              <span>Email</span>
              <b>{me?.email || '—'}</b>
            </div>
            <div className="kv-row">
              <span>Environment</span>
              <b>{meta?.environment || '—'}</b>
            </div>
            <div className="kv-row">
              <span>API version</span>
              <b>{meta?.version || '—'}</b>
            </div>
            <div className="kv-row">
              <span>Authentication required</span>
              <b>{meta?.auth_required ? <Badge tone="success">Yes</Badge> : <Badge tone="warning">Development bypass</Badge>}</b>
            </div>
            <div className="kv-row">
              <span>Device shared secret</span>
              <b>{meta?.device_auth_required ? <Badge tone="success">Configured</Badge> : <Badge tone="neutral">Not configured</Badge>}</b>
            </div>
            <div className="kv-row">
              <span>TCP receiver</span>
              <b>
                {meta?.tcp?.enabled ? `${meta.tcp.host}:${meta.tcp.port}` : 'Disabled'}
              </b>
            </div>
          </div>
            <div className="info-banner" style={{ marginTop: 14, marginBottom: 0 }}>
            <ShieldCheck />
            <div>
              Production deployments must configure an email provider (<span className="mono">EMAIL_PROVIDER</span>,{' '}
              <span className="mono">EMAIL_FROM</span>), serve over HTTPS, and set <span className="mono">CORS_ORIGINS</span> and a
              stable <span className="mono">JWT_SECRET</span>. Browser sessions use HttpOnly cookies and are revoked on sign-out.
            </div>
          </div>
        </Card>
      </div>

      {me?.role === 'admin' ? (
        <Card
          title="Audit trail"
          subtitle="Administrator actions recorded by the API (newest first)"
          actions={
            <button type="button" className="btn btn-sm" onClick={loadAudit} disabled={auditLoading}>
              <RefreshCw /> Reload
            </button>
          }
          flush
          style={{ marginTop: 16 }}
        >
        {auditLoading ? (
          <LoadingBlock label="Loading audit records…" />
        ) : auditError ? (
          <div style={{ padding: 16 }}>
            <ErrorBanner message={auditError} onRetry={loadAudit} resource="audit log" />
            <p className="small muted" style={{ lineHeight: 1.6 }}>
              The audit endpoint requires an administrator role. Other roles can use the rest of the console but cannot read audit records.
            </p>
          </div>
        ) : audit.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className="primary" style={{ fontWeight: 500 }}>{fmtDateTime(row.created_at)}</span>
                      <span className="secondary">{timeAgo(row.created_at)}</span>
                    </td>
                    <td>
                      <span className="primary" style={{ fontWeight: 500 }}>{row.actor}</span>
                      <span className="secondary">{row.actor_role}</span>
                    </td>
                    <td>
                      <Badge tone={row.action === 'delete' ? 'danger' : row.action === 'create' ? 'success' : 'neutral'}>{row.action}</Badge>
                    </td>
                    <td>
                      <span className="primary" style={{ fontWeight: 500 }}>{row.entity}</span>
                      <span className="secondary mono">{row.entity_id || '—'}</span>
                    </td>
                    <td className="mono">{row.detail || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={FileText} title="No audit records yet" description="Create, update or delete operations and sign-ins will appear here." />
        )}
        </Card>
      ) : null}

      <div className="grid-3" style={{ marginTop: 16 }}>
        <Card title="Telemetry provenance" subtitle="Simulation remains visible">
          <div className="row" style={{ marginBottom: 10 }}>
            <Database size={16} className="muted" />
            <b className="small">Persisted history is the source of truth</b>
          </div>
          <p className="small muted" style={{ lineHeight: 1.65 }}>
            Simulator frames are stored with <span className="mono">simulated: true</span>. Reports and dashboards preserve that flag and
            never relabel simulation output as hardware data.
          </p>
        </Card>
        <Card title="Hardware status" subtitle="No unsupported claims">
          <div className="row" style={{ marginBottom: 10 }}>
            <Activity size={16} className="muted" />
            <b className="small">Receiver capability unverified</b>
          </div>
          <p className="small muted" style={{ lineHeight: 1.65 }}>
            The IVTD model, GNSS chipset and NavIC support have not been verified against hardware documentation. Diagnostics show
            receiver-reported values without claiming verified capability.
          </p>
        </Card>
        <Card title="Production checklist" subtitle="Before go-live">
          <div className="stack" style={{ gap: 9 }}>
            {[
              'Configure EMAIL_PROVIDER, EMAIL_FROM and provider credentials',
              'Provision the first administrator with manage_users',
              'Set JWT_SECRET and DEVICE_AUTH_TOKEN',
              'Run PostgreSQL and apply schema migration',
              'Serve the frontend and API over HTTPS',
              'Configure CORS_ORIGINS explicitly',
              'Back up location_history regularly',
            ].map((item) => (
              <div className="row" key={item} style={{ gap: 8, alignItems: 'flex-start' }}>
                <KeyRound size={13} className="muted" style={{ marginTop: 2 }} />
                <span className="small">{item}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="row small muted" style={{ marginTop: 18, gap: 8 }}>
        <Server size={13} />
        {meta?.simulation_notice || 'No hardware is connected by this service. The bundled simulator always labels its frames as simulated.'}
      </div>
    </>
  );
}
