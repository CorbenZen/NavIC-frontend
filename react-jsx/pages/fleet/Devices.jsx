import { Activity, AlertCircle, Cpu, Pencil, Plus, Satellite, Trash2, Wifi, WifiOff } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api } from '@services/api';
import { Badge, Card, EmptyState, PageHeader } from '../../components/common';
import { DataSourceFilter, DATA_SOURCE_LABELS, Field, matchesDataSource, rowDataSource, SearchInput } from '../../components/forms';
import { ConfirmDialog, Modal } from '../../components/modals';
import { ErrorBanner, InfoBanner, LoadingBlock, useToast } from '../../components/feedback';
import { useFleet } from '@react/hooks/useFleet';
import { fmtDateTime, fmtNumber, fmtSpeed, timeAgo } from '@react/utils/format';

const IDENTIFIER_TYPES = ['simulated_imei', 'simulated_serial', 'imei', 'serial', 'iccid', 'device_serial'];

const CONSTELLATIONS = ['navic', 'gps', 'glonass', 'galileo', 'beidou', 'qzss'];
const CONSTELLATION_NAMES = { navic: 'NavIC', gps: 'GPS', glonass: 'GLONASS', galileo: 'Galileo', beidou: 'BeiDou', qzss: 'QZSS' };

function emptyForm() {
  return { device_id: '', device_type: 'IVTD', identifier_type: 'serial', bus_id: '', simulated: false, active: true };
}

function compatibilityLabel(value) {
  if (value === 'supported_detected') return 'Supported and detected';
  if (value === 'supported_not_detected') return 'Supported, not detected';
  if (value === 'unsupported') return 'Unsupported';
  return 'Unsupported or unverified';
}

function InfoCard({ title, children, icon: Icon }) {
  return (
    <div className="info-card" style={{ border: '1px solid var(--line)', borderRadius: 8, background: 'var(--surface-sunken)', padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <Icon style={{ width: 18, height: 18, color: 'var(--brand)', flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--ink)', marginBottom: 4 }}>{title}</div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

export function Devices() {
  const { devices, vehicles, loading, error, refresh, refreshing, dataSource } = useFleet();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [detailDevice, setDetail] = useState(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return devices.filter((device) => {
      if (stateFilter === 'online' && !device.online) return false;
      if (stateFilter === 'offline' && device.online) return false;
      if (stateFilter === 'fresh' && !device.telemetry_fresh) return false;
      if (stateFilter === 'stale' && device.telemetry_fresh) return false;
      if (stateFilter === 'inactive' && device.active) return false;
      if (!matchesDataSource(device, dataSource)) return false;
      if (!needle) return true;
      return [device.device_id, device.device_type, device.identifier_type, device.identity?.registration_number, device.identity?.vehicle_id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [devices, query, stateFilter, dataSource]);

  const openCreate = () => {
    setEditing({ id: null });
    setForm(emptyForm());
    setFormError('');
  };

  const openEdit = (device) => {
    setEditing(device);
    setForm({
      device_id: device.device_id || '',
      device_type: device.device_type || 'IVTD',
      identifier_type: device.identifier_type || 'serial',
      bus_id: device.bus_id == null ? '' : String(device.bus_id),
      simulated: Boolean(device.simulated),
      active: device.active !== false,
    });
    setFormError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    const payload = {
      device_id: form.device_id.trim(),
      device_type: form.device_type.trim(),
      identifier_type: form.identifier_type,
      bus_id: form.bus_id ? Number(form.bus_id) : null,
      simulated: Boolean(form.simulated),
      active: Boolean(form.active),
    };
    try {
      if (editing?.id) await api.updateDevice(editing.id, payload);
      else await api.createDevice(payload);
      toast.success(editing?.id ? 'Device updated.' : 'Device registered.');
      setEditing(null);
      await refresh();
    } catch (saveError) {
      setFormError(saveError.message || 'Could not save the device.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api.deleteDevice(pendingDelete.id);
      toast.success('Device removed from the registry.');
      setPendingDelete(null);
      await refresh();
    } catch (deleteError) {
      toast.error(deleteError.message || 'Could not delete the device.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Fleet management"
        title="Tracking devices"
        subtitle="Registry of IVTD identifiers accepted by the TCP receiver. A device may be assigned to one vehicle."
        actions={
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Plus /> Register device
          </button>
        }
      />

      {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}

      <InfoCard
        title="Device registration"
        icon={AlertCircle}
      >
        Register only identifiers that correspond to a real IVTD or the bundled simulator. The simulator always sends{' '}
        <span className="mono">simulated: true</span>. Receiver model, GNSS capabilities and NavIC support remain unverified until hardware
        documentation or output is available.
      </InfoCard>

      <Card actions={<span className="count">{filtered.length} of {devices.length}</span>} flush>
        <div className="filter-bar">
          <SearchInput value={query} onChange={setQuery} placeholder="Search devices…" ariaLabel="Search devices" className="grow" />
          <select className="input" value={stateFilter} onChange={(event) => setStateFilter(event.target.value)} aria-label="Filter devices by status">
            <option value="all">All devices</option>
            <option value="online">TCP online</option>
            <option value="offline">No TCP session</option>
            <option value="fresh">Fresh telemetry</option>
            <option value="stale">Stale telemetry</option>
            <option value="inactive">Inactive</option>
          </select>
          <DataSourceFilter />
        </div>

        {loading && !devices.length ? (
          <LoadingBlock label="Loading devices…" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Type</th>
                  <th>Assigned vehicle</th>
                  <th>TCP</th>
                  <th>Telemetry</th>
                  <th>Last communication</th>
                  <th>Source</th>
                  <th className="actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length ? (
                  filtered.map((device) => (
                    <tr key={device.id}>
                      <td>
                        <button type="button" className="btn btn-sm" style={{ border: 0, background: 'transparent', padding: 0 }} onClick={() => setDetail(device)}>
                          <span className="mono primary" style={{ color: 'var(--brand-deep)' }}>
                            {device.device_id}
                          </span>
                        </button>
                        <span className="secondary">
                          {device.identity?.registration_number || <Badge tone="neutral">No vehicle</Badge>}
                          {device.active ? '' : ' · inactive'}
                        </span>
                      </td>
                      <td>
                        <span className="primary" style={{ fontWeight: 500 }}>
                          {device.device_type}
                        </span>
                        <span className="secondary">{device.identifier_type?.replaceAll('_', ' ')}</span>
                      </td>
                      <td>
                        {device.identity?.registration_number ? (
                          <>
                            <span className="primary" style={{ fontWeight: 500 }}>
                              {device.identity.registration_number}
                            </span>
                            <span className="secondary">{device.identity.vehicle_id}</span>
                          </>
                        ) : (
                          <Badge tone="neutral">Unassigned</Badge>
                        )}
                      </td>
                      <td>
                        {device.online ? (
                          <Badge tone="success" dot>
                            <Wifi size={10} /> Online
                          </Badge>
                        ) : (
                          <Badge tone="neutral">
                            <WifiOff size={10} /> No session
                          </Badge>
                        )}
                      </td>
                      <td>
                        {device.telemetry_fresh ? (
                          <Badge tone="success">Fresh · {device.age_label}</Badge>
                        ) : device.last_communication ? (
                          <Badge tone="warning">Stale · {device.age_label}</Badge>
                        ) : (
                          <Badge tone="neutral">No data</Badge>
                        )}
                      </td>
                      <td>{device.last_communication ? timeAgo(device.last_communication) : 'Never'}</td>
                      <td><Badge tone={rowDataSource(device) === 'hardware' ? 'neutral' : 'warning'}>
                          {DATA_SOURCE_LABELS[rowDataSource(device)]}
                        </Badge></td>
                      <td className="actions">
                        <button type="button" className="btn btn-sm" onClick={() => setDetail(device)}>
                          <Activity /> Diagnostics
                        </button>
                        <button type="button" className="btn btn-sm" onClick={() => openEdit(device)}>
                          <Pencil />
                        </button>
                        <button type="button" className="btn btn-sm btn-danger" onClick={() => setPendingDelete(device)}>
                          <Trash2 />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState
                        icon={Cpu}
                        title={devices.length ? 'No devices match this filter' : 'No tracking devices registered'}
                        description={
                          devices.length
                            ? 'Change the search or device filter.'
                            : 'Register the device identifier before it can send telemetry to the TCP receiver.'
                        }
                        action={
                          !devices.length ? (
                            <button type="button" className="btn btn-sm btn-primary" onClick={openCreate}>
                              <Plus /> Register device
                            </button>
                          ) : null
                        }
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={Boolean(editing)}
        title={editing?.id ? 'Edit device' : 'Register tracking device'}
        subtitle="The device identifier must match the identifier in the telemetry frame exactly."
        onClose={() => setEditing(null)}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="device-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save device'}
            </button>
          </>
        }
      >
        <form id="device-form" className="form-grid" onSubmit={submit}>
          {formError ? <div className="form-error span-2">{formError}</div> : null}
          <Field label="Device identifier" hint="1–64 safe characters: letters, digits, dot, underscore, colon or hyphen.">
            <input required value={form.device_id} onChange={(event) => setForm({ ...form, device_id: event.target.value })} placeholder="IVTD_BUS_01" />
          </Field>
          <Field label="Device type" hint="Free text, for example IVTD or the receiver model.">
            <input required value={form.device_type} onChange={(event) => setForm({ ...form, device_type: event.target.value })} />
          </Field>
          <Field label="Identifier type">
            <select value={form.identifier_type} onChange={(event) => setForm({ ...form, identifier_type: event.target.value })}>
              {IDENTIFIER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Assigned vehicle">
            <select value={form.bus_id} onChange={(event) => setForm({ ...form, bus_id: event.target.value })}>
              <option value="">Unassigned</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.registration_number} · {vehicle.vehicle_id}
                </option>
              ))}
            </select>
          </Field>
          <label className="check">
            <input type="checkbox" checked={form.simulated} onChange={(event) => setForm({ ...form, simulated: event.target.checked })} />
            Simulator-backed device
          </label>
          <label className="check">
            <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
            Active in the registry
          </label>
          <div className="span-2 info-banner" style={{ marginBottom: 0 }}>
            <Cpu />
            <div>
              Simulator-backed means the bundled simulator may send frames for this identifier. It does not make received data hardware data.
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(detailDevice)}
        wide
        title={detailDevice ? `Diagnostics · ${detailDevice.device_id}` : 'Device diagnostics'}
        subtitle="Receiver-reported values are shown as received. Capability remains unverified without hardware documentation."
        onClose={() => setDetail(null)}
      >
        {detailDevice ? <DeviceDiagnostics device={detailDevice} /> : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete device?"
        message={
          pendingDelete
            ? `Delete ${pendingDelete.device_id} from the registry? The API refuses deletion when persisted telemetry exists (HTTP 409) and asks you to deactivate instead.`
            : ''
        }
        busy={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={remove}
      />
    </>
  );
}

function DeviceDiagnostics({ device }) {
  const latest = device.latest;
  const compatibility = device.gnss_compatibility || {};
  const reported = device.reported_constellations || [];

  return (
    <div className="stack">
      <div className="row wrap">
        {device.online ? <Badge tone="success" dot>TCP session open</Badge> : <Badge tone="neutral">No TCP session</Badge>}
        {device.telemetry_fresh ? <Badge tone="success">Fresh telemetry</Badge> : <Badge tone="warning">Telemetry {device.age_label}</Badge>}
        <Badge tone={rowDataSource(device) === 'hardware' ? 'neutral' : 'warning'}>
                            {DATA_SOURCE_LABELS[rowDataSource(device)]}
                          </Badge>
        {device.active ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Inactive</Badge>}
      </div>

      <div className="kv-list">
        <div className="kv-row">
          <span>Assigned vehicle</span>
          <b>{device.identity?.registration_number || 'Unassigned'}</b>
        </div>
        <div className="kv-row">
          <span>Route</span>
          <b>{device.identity?.route_name || 'Unassigned'}</b>
        </div>
        <div className="kv-row">
          <span>Last communication</span>
          <b>{device.last_communication ? fmtDateTime(device.last_communication) : 'Never'}</b>
        </div>
        <div className="kv-row">
          <span>Identifier type</span>
          <b>{device.identifier_type?.replaceAll('_', ' ') || '—'}</b>
        </div>
      </div>

      <div>
        <h3 className="section-title" style={{ marginBottom: 9 }}>Latest receiver-reported values</h3>
        {latest ? (
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
              <small>Latitude / longitude</small>
              <b className="mono">
                {latest.latitude == null ? '—' : Number(latest.latitude).toFixed(6)} / {latest.longitude == null ? '—' : Number(latest.longitude).toFixed(6)}
              </b>
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
              <small>Ignition / odometer</small>
              <b>
                {latest.ignition == null ? 'Not reported' : latest.ignition ? 'On' : 'Off'} /{' '}
                {latest.odometer == null ? 'Not reported' : fmtNumber(latest.odometer, 1)}
              </b>
            </div>
          </div>
        ) : (
          <EmptyState title="No telemetry received" description="This device has no persisted fixes yet." />
        )}
      </div>

      <div>
        <h3 className="section-title" style={{ marginBottom: 4 }}>
          <Satellite size={14} style={{ verticalAlign: '-2px', marginRight: 5 }} />
          Constellation capability
        </h3>
        <p className="section-sub" style={{ marginBottom: 9 }}>
          Capability is marked unverified. Receiver-reported metadata is not the same as verified hardware support.
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

      {reported.length ? (
        <InfoBanner>
          Receiver-reported constellation metadata: {reported.map((key) => CONSTELLATION_NAMES[key] || key).join(', ')}. This is not
          hardware-verified support.
        </InfoBanner>
      ) : null}

      <div>
        <h3 className="section-title" style={{ marginBottom: 9 }}>Latest payload</h3>
        <pre className="code-block">{JSON.stringify(latest ?? { message: 'no telemetry' }, null, 2)}</pre>
      </div>
    </div>
  );
}
