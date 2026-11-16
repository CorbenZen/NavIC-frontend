import { Bookmark, BookmarkX, BusFront, ChevronLeft, ChevronRight, Copy, ExternalLink, Pencil, Plus, RotateCcw, Share2, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api } from '@services/api';
import { Badge, Card, EmptyState, PageHeader, StatusBadge } from '../../components/common';
import { DATA_SOURCE_OPTIONS, Field, matchesDataSource, SearchInput } from '../../components/forms';
import { ConfirmDialog, Modal } from '../../components/modals';
import { ErrorBanner, LoadingBlock, useToast } from '../../components/feedback';
import { useFleet } from '@react/hooks/useFleet';
import { useTableState } from '@react/hooks/useTableState';
import { fmtDateTime, fmtSpeed, timeAgo } from '@react/utils/format';

const DATA_SOURCE_FILTERS = DATA_SOURCE_OPTIONS.map((option) => [option.value, option.label]);

const COLUMNS = [
  { key: 'vehicle_id', label: 'Vehicle', sortable: true },
  { key: 'registration_number', label: 'Registration', sortable: true },
  { key: 'driver_name', label: 'Driver', sortable: true },
  { key: 'route_name', label: 'Route', sortable: true },
  { key: 'device_id', label: 'Device', sortable: true },
  { key: 'status_key', label: 'Status', sortable: true },
  { key: 'speed', label: 'Speed', sortable: true, className: 'num' },
  { key: 'last_seen', label: 'Last seen', sortable: true },
];

const STATUS_OPTIONS = [
  ['all', 'All statuses'],
  ['moving', 'Moving'],
  ['idle', 'Idle'],
  ['stopped', 'Stopped'],
  ['offline', 'Offline'],
  ['no_data', 'No data'],
];

function emptyForm() {
  return { vehicle_id: '', registration_number: '', driver_id: '', route_id: '', device_id: '' };
}

function keyForStatus(status) {
  return String(status || 'unknown').toLowerCase().replace(/\s+/g, '_');
}

function getSortValue(row, column) {
  switch (column) {
    case 'vehicle_id':
      return row.vehicle_id?.toLowerCase();
    case 'registration_number':
      return row.registration_number?.toLowerCase();
    case 'driver_name':
      return (row.driver_name || '').toLowerCase();
    case 'route_name':
      return (row.route_name || '').toLowerCase();
    case 'device_id':
      return (row.device_id || '').toLowerCase();
    case 'status_key':
      return row.status_key || keyForStatus(row.status);
    case 'speed':
      return row.speed ?? -1;
    case 'last_seen':
      return row.last_seen ? new Date(row.last_seen).getTime() : -1;
    default:
      return row[column];
  }
}

export function Vehicles() {
  const { vehicles, drivers, routes, devices, loading, error, refresh, refreshing, dataSource, setDataSource } = useFleet();
  const toast = useToast();

  // Table state with URL persistence
  const tableState = useTableState({
    pageKey: 'vehicles_page',
    pageSizeKey: 'vehicles_pageSize',
    sortKey: 'vehicles_sort',
    sortDirKey: 'vehicles_sortDir',
    filterPrefix: 'vehicles_filter.',
    defaultPageSize: 25,
    defaultSort: 'vehicle_id',
    defaultSortDir: 'asc',
    savedFiltersKey: 'vehicles_savedFilters',
    pageSizeOptions: [10, 25, 50, 100],
  });

  const [query, setQuery] = useState(() => tableState.filters.q || '');
  const [statusFilter, setStatusFilter] = useState(() => tableState.filters.status || 'all');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showSavedFilters, setShowSavedFilters] = useState(false);
  const [shareTokenVehicle, setShareTokenVehicle] = useState(null);
  const [shareTokens, setShareTokens] = useState([]);
  const [shareTokenLoading, setShareTokenLoading] = useState(false);
  const [shareTokenForm, setShareTokenForm] = useState({ name: '', expires_in_days: null });
  const [shareTokenError, setShareTokenError] = useState('');
  const [pendingRevoke, setPendingRevoke] = useState(null);
  const [newToken, setNewToken] = useState(null);

  // Sync local filter state to tableState
  const handleQueryChange = (value) => {
    setQuery(value);
    tableState.setFilters('q', value);
  };

  const handleStatusFilterChange = (value) => {
    setStatusFilter(value);
    tableState.setFilters('status', value);
  };

  const handleDataSourceChange = (value) => {
    setDataSource(value);
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let result = vehicles.filter((vehicle) => {
      if (statusFilter !== 'all' && keyForStatus(vehicle.status) !== statusFilter) return false;
      const device = devices.find((d) => d.bus_id === vehicle.id);
      const provenance = {
        ...vehicle,
        simulated: device?.simulated ?? vehicle.simulated,
        data_source: device?.data_source ?? vehicle.data_source,
      };
      if (!matchesDataSource(provenance, dataSource)) return false;
      if (!needle) return true;
      return [
        vehicle.vehicle_id,
        vehicle.registration_number,
        vehicle.driver_name,
        vehicle.route_name,
        vehicle.device_id,
      ]
        .filter(Boolean)
        .some((val) => String(val).toLowerCase().includes(needle));
    });

    // Apply sorting
    result = tableState.sortedData(result, getSortValue);

    return result;
  }, [vehicles, query, statusFilter, dataSource, devices, tableState]);

  // Paginate
  const paginatedVehicles = useMemo(() => tableState.paginatedData(filtered), [filtered, tableState]);

  const openCreate = () => {
    setEditing({ id: null });
    setForm(emptyForm());
    setFormError('');
  };

  const openEdit = (vehicle) => {
    setEditing(vehicle);
    setForm({
      vehicle_id: vehicle.vehicle_id || '',
      registration_number: vehicle.registration_number || '',
      driver_id: vehicle.driver_id == null ? '' : String(vehicle.driver_id),
      route_id: vehicle.route_id == null ? '' : String(vehicle.route_id),
      device_id: vehicle.device_id || '',
    });
    setFormError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    const payload = {
      vehicle_id: form.vehicle_id.trim(),
      registration_number: form.registration_number.trim(),
      driver_id: form.driver_id ? Number(form.driver_id) : null,
      route_id: form.route_id ? Number(form.route_id) : null,
      device_id: form.device_id || null,
    };
    try {
      if (editing?.id) await api.updateVehicle(editing.id, payload);
      else await api.createVehicle(payload);
      toast.success(editing?.id ? 'Vehicle updated.' : 'Vehicle created.');
      setEditing(null);
      await refresh();
    } catch (saveError) {
      setFormError(saveError.message || 'Could not save the vehicle.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api.deleteVehicle(pendingDelete.id);
      toast.success('Vehicle deleted. Its device assignment was cleared.');
      setPendingDelete(null);
      await refresh();
    } catch (deleteError) {
      toast.error(deleteError.message || 'Could not delete the vehicle.');
    } finally {
      setDeleting(false);
    }
  };

  // Share token functions
  const openShareTokens = async (vehicle) => {
    setShareTokenVehicle(vehicle);
    setShareTokenLoading(true);
    setShareTokenError('');
    try {
      const tokens = await api.listShareTokens(vehicle.id);
      setShareTokens(tokens);
    } catch (err) {
      setShareTokenError(err.message || 'Could not load share links.');
    } finally {
      setShareTokenLoading(false);
    }
  };

  const createShareToken = async (e) => {
    e.preventDefault();
    if (!shareTokenVehicle) return;
    setShareTokenError('');
    try {
      const result = await api.createShareToken(shareTokenVehicle.id, {
        name: shareTokenForm.name,
        expires_in_days: shareTokenForm.expires_in_days || undefined,
      });
      setNewToken(result.token);
      toast.success('Share link created!');
      // Refresh the list
      const tokens = await api.listShareTokens(shareTokenVehicle.id);
      setShareTokens(tokens);
      setShareTokenForm({ name: '', expires_in_days: null });
    } catch (err) {
      setShareTokenError(err.message || 'Could not create share link.');
    }
  };

  const revokeShareToken = async () => {
    if (!shareTokenVehicle || !pendingRevoke) return;
    try {
      await api.revokeShareToken(shareTokenVehicle.id, pendingRevoke.id);
      toast.success('Share link revoked.');
      setPendingRevoke(null);
      const tokens = await api.listShareTokens(shareTokenVehicle.id);
      setShareTokens(tokens);
    } catch (err) {
      toast.error(err.message || 'Could not revoke share link.');
    }
  };

  const copyShareLink = (token) => {
    if (!token) return;
    const url = `${window.location.origin}/public/bus/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Link copied to clipboard!');
    }).catch(() => {
      toast.error('Could not copy link. Select the link text and copy it manually.');
    });
  };

  const saveCurrentFilter = () => {
    const name = prompt('Save filter as:');
    if (name) {
      tableState.saveFilter(name, {
        filters: { q: query, status: statusFilter },
        page: tableState.page,
        pageSize: tableState.pageSize,
        sort: tableState.sort,
        sortDir: tableState.sortDir,
      });
      toast.success(`Filter "${name}" saved.`);
      setShowSavedFilters(false);
    }
  };

  const applySavedFilter = (name) => {
    const filter = tableState.savedFilters[name];
    if (filter) {
      setQuery(filter.filters?.q || '');
      setStatusFilter(filter.filters?.status || 'all');
      tableState.applySavedFilter(name);
      setShowSavedFilters(false);
    }
  };

  const deleteSavedFilter = (name, event) => {
    event.stopPropagation();
    if (confirm(`Delete saved filter "${name}"?`)) {
      tableState.deleteSavedFilter(name);
      toast.success(`Filter "${name}" deleted.`);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Fleet management"
        title="Vehicles"
        subtitle="The canonical vehicle record. Assign a driver, a route and one active tracking device per vehicle."
        actions={
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Plus /> Add vehicle
          </button>
        }
      />

      {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}

      <Card
        actions={
          <>
            <span className="count">{filtered.length} of {vehicles.length}</span>
            <div className="saved-filters-dropdown">
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => setShowSavedFilters(!showSavedFilters)}
                aria-expanded={showSavedFilters}
                aria-haspopup="listbox"
              >
                <Bookmark /> Saved filters
              </button>
              {showSavedFilters && (
                <div className="saved-filters-menu" role="listbox">
                  {Object.keys(tableState.savedFilters).length === 0 ? (
                    <div className="saved-filter-empty">No saved filters</div>
                  ) : (
                    Object.entries(tableState.savedFilters).map(([name, filter]) => (
                      <div key={name} className="saved-filter-item" role="option">
                        <button
                          type="button"
                          className="saved-filter-apply"
                          onClick={() => applySavedFilter(name)}
                        >
                          {name}
                          <span className="saved-filter-meta">
                            {filter.filters?.status && filter.filters.status !== 'all' && `Status: ${filter.filters.status}`}
                            {filter.filters?.q && ` Search: "${filter.filters.q}"`}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="saved-filter-delete"
                          onClick={(e) => deleteSavedFilter(name, e)}
                          aria-label={`Delete filter ${name}`}
                        >
                          <BookmarkX />
                        </button>
                      </div>
                    ))
                  )}
                  <div className="saved-filter-divider" />
                  <button type="button" className="saved-filter-save" onClick={saveCurrentFilter}>
                    <Bookmark /> Save current filter
                  </button>
                </div>
              )}
            </div>
          </>
        }
        flush
      >
        <div className="filter-bar">
          <SearchInput value={query} onChange={handleQueryChange} placeholder="Search vehicles…" ariaLabel="Search vehicles" className="grow" />
          <select className="input" value={statusFilter} onChange={(event) => handleStatusFilterChange(event.target.value)} aria-label="Filter by status">
            {STATUS_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select className="input data-source-filter" value={dataSource} onChange={(e) => handleDataSourceChange(e.target.value)} aria-label="Filter by data source">
            {DATA_SOURCE_FILTERS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          {tableState.filters.q || tableState.filters.status ? (
            <button type="button" className="btn btn-sm btn-ghost" onClick={tableState.clearFilters}>
              <RotateCcw className="spin" /> Clear filters
            </button>
          ) : null}
        </div>

        {loading && !vehicles.length ? (
          <LoadingBlock label="Loading vehicles…" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className={col.className}
                      {...(col.sortable ? tableState.getSortProps(col.key) : {})}
                    >
                      <div className="th-content">
                        <span>{col.label}</span>
                        {col.sortable && tableState.getSortIndicator(col.key) && (
                          <span className="sort-indicator" aria-hidden="true">{tableState.getSortIndicator(col.key)}</span>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedVehicles.length ? (
                  paginatedVehicles.map((vehicle) => (
                    <tr key={vehicle.id}>
                      <td>
                        <span className="primary">{vehicle.vehicle_id}</span>
                        <span className="secondary">{vehicle.simulated ? 'Simulated telemetry' : 'Vehicle record'}</span>
                      </td>
                      <td>{vehicle.registration_number}</td>
                      <td>
                        <span className="primary" style={{ fontWeight: 500 }}>
                          {vehicle.driver_name || <Badge tone="neutral">Unassigned</Badge>}
                        </span>
                        <span className="secondary">{vehicle.driver_phone || 'No phone recorded'}</span>
                      </td>
                      <td>
                        <span className="row" style={{ gap: 6 }}>
                          {vehicle.route_color ? <i style={{ width: 8, height: 8, borderRadius: '50%', background: vehicle.route_color }} /> : null}
                          {vehicle.route_name || <Badge tone="neutral">Unassigned</Badge>}
                        </span>
                      </td>
                      <td className="mono">{vehicle.device_id || '—'}</td>
                      <td>
                        <StatusBadge status={vehicle.status} statusKey={vehicle.status_key || keyForStatus(vehicle.status)} />
                      </td>
                      <td className="num">{fmtSpeed(vehicle.speed)}</td>
                      <td>{vehicle.last_seen ? timeAgo(vehicle.last_seen) : 'No data'}</td>
                      <td className="actions">
                        <button type="button" className="btn btn-sm" onClick={() => openEdit(vehicle)}>
                          <Pencil /> Edit
                        </button>
                        <button type="button" className="btn btn-sm" onClick={() => openShareTokens(vehicle)} title="Share links">
                          <Share2 size={14} />
                        </button>
                        <button type="button" className="btn btn-sm btn-danger" onClick={() => setPendingDelete(vehicle)}>
                          <Trash2 />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={COLUMNS.length + 1}>
                      <EmptyState
                        icon={BusFront}
                        title={vehicles.length ? 'No vehicles match this filter' : 'No vehicles registered'}
                        description={vehicles.length ? 'Change the search or status filter.' : 'Add the first vehicle, then assign a driver, route and device.'}
                        action={
                          !vehicles.length ? (
                            <button type="button" className="btn btn-sm btn-primary" onClick={openCreate}>
                              <Plus /> Add vehicle
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

        {filtered.length > tableState.pageSize && (
          <div className="table-pagination">
            <span className="pagination-info">
              Showing {tableState.page * tableState.pageSize + 1}–{Math.min((tableState.page + 1) * tableState.pageSize, filtered.length)} of {filtered.length}
            </span>
            <div className="pagination-controls">
              <select
                className="input input-sm"
                value={tableState.pageSize}
                onChange={(e) => tableState.setPageSize(Number(e.target.value))}
                aria-label="Rows per page"
              >
                {tableState.pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size} per page
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => tableState.setPage(tableState.page - 1)}
                disabled={tableState.page === 0}
                aria-label="Previous page"
              >
                <ChevronLeft />
              </button>
              <span className="page-indicator" aria-current="page">
                Page {tableState.page + 1} of {tableState.totalPages(filtered.length)}
              </span>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => tableState.setPage(tableState.page + 1)}
                disabled={tableState.page >= tableState.totalPages(filtered.length) - 1}
                aria-label="Next page"
              >
                <ChevronRight />
              </button>
            </div>
          </div>
        )}
      </Card>

      <Modal
        open={Boolean(editing)}
        title={editing?.id ? 'Edit vehicle' : 'Add vehicle'}
        subtitle="Vehicle identifiers must be unique. A device can be assigned to one vehicle at a time."
        onClose={() => setEditing(null)}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="vehicle-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save vehicle'}
            </button>
          </>
        }
      >
        <form id="vehicle-form" className="form-grid" onSubmit={submit}>
          {formError ? <div className="form-error span-2">{formError}</div> : null}
          <Field label="Vehicle identifier" hint="Short unique code, for example BUS-01.">
            <input type="text" value={form.vehicle_id} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })} required />
          </Field>
          <Field label="Registration number" hint="Official plate, for example KA-04-HB-1001.">
            <input type="text" value={form.registration_number} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} required />
          </Field>
          <Field label="Driver">
            <select value={form.driver_id} onChange={(e) => setForm({ ...form, driver_id: e.target.value })}>
              <option value="">Unassigned</option>
              {drivers.filter((d) => d.active).map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name} ({driver.license_number})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Route">
            <select value={form.route_id} onChange={(e) => setForm({ ...form, route_id: e.target.value })}>
              <option value="">Unassigned</option>
              {routes.map((route) => (
                <option key={route.id} value={route.id}>
                  {route.name} ({route.identifier})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Device">
            <select value={form.device_id} onChange={(e) => setForm({ ...form, device_id: e.target.value })}>
              <option value="">Unassigned</option>
              {devices.filter((d) => d.active && !d.bus_id).map((device) => (
                <option key={device.id} value={device.device_id}>
                  {device.device_id} ({device.device_type}) {device.simulated ? '· Simulated' : ''}
                </option>
              ))}
            </select>
          </Field>
        </form>
      </Modal>

      {/* Share Token Modal */}
      <Modal
        open={Boolean(shareTokenVehicle)}
        title={`Share links for ${shareTokenVehicle?.registration_number || shareTokenVehicle?.vehicle_id}`}
        subtitle="Create public share links to show live bus position on a read-only page. Links can be revoked at any time."
        onClose={() => { setShareTokenVehicle(null); setNewToken(null); setPendingRevoke(null); }}
        footer={
          <>
            <button type="button" className="btn" onClick={() => { setShareTokenVehicle(null); setNewToken(null); }}>
              Close
            </button>
          </>
        }
      >
        {shareTokenError && <div className="form-error" style={{ marginBottom: 12 }}>{shareTokenError}</div>}

        {/* New token display */}
        {newToken && (
          <div className="form-success" style={{ marginBottom: 16, padding: 12, background: 'var(--success-soft)', border: '1px solid var(--success)', borderRadius: 'var(--radius)', color: 'var(--success)' }}>
            <div className="row between" style={{ marginBottom: 8 }}>
              <b>New share link created!</b>
              <button type="button" className="btn btn-sm" onClick={() => copyShareLink(newToken)}>
                <Copy size={14} /> Copy link
              </button>
            </div>
            <div className="mono small" style={{ wordBreak: 'break-all' }}>
              {window.location.origin}/public/bus/{newToken}
            </div>
            <p className="small muted" style={{ marginTop: 8 }}>
              <b>Important:</b> This token will not be shown again. Copy it now or revoke and create a new one.
            </p>
          </div>
        )}

        {/* Create new share token form */}
        <form onSubmit={createShareToken} style={{ marginBottom: 16 }}>
          <Field label="Link name (optional)">
            <input
              type="text"
              value={shareTokenForm.name}
              onChange={(e) => setShareTokenForm({ ...shareTokenForm, name: e.target.value })}
              placeholder="e.g., Parent portal, Driver app"
            />
          </Field>
          <Field label="Expires in (days, optional)">
            <input
              type="number"
              min="1"
              max="365"
              value={shareTokenForm.expires_in_days || ''}
              onChange={(e) => setShareTokenForm({ ...shareTokenForm, expires_in_days: e.target.value ? Number(e.target.value) : null })}
              placeholder="Leave empty for no expiry"
            />
          </Field>
          <button type="submit" className="btn btn-primary" disabled={shareTokenLoading}>
            {shareTokenLoading ? 'Creating…' : 'Create share link'}
          </button>
        </form>

        {/* Existing share tokens list */}
        <div className="share-tokens-list" style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}>
          <h4 style={{ margin: '0 0 12px', fontSize: 14 }}>Existing links ({shareTokens.length})</h4>
          {shareTokens.length > 0 ? (
            <p className="muted small" style={{ margin: '0 0 10px' }}>
              Only a hash of each link is stored, so the link text cannot be shown again. Revoke and create a new link
              if you lost it.
            </p>
          ) : null}
          {shareTokens.length === 0 ? (
            <p className="muted small" style={{ margin: 0 }}>No share links yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {shareTokens.map((token) => (
                <div key={token.id} className="share-token-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', background: 'var(--surface-soft)', border: '1px solid var(--line)', borderRadius: 'var(--radius)' }}>
                  <div className="row" style={{ gap: 8, flex: 1, minWidth: 0 }}>
                    <div>
                      <b>{token.name || 'Unnamed link'}</b>
                      <div className="small muted">
                        Created {timeAgo(token.created_at)}
                        {token.expires_at ? ` · Expires ${fmtDateTime(token.expires_at)}` : ' · No expiry'}
                        {token.revoked_at ? ' · Revoked' : ''}
                      </div>
                    </div>
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    {!token.revoked_at && (
                      <button type="button" className="btn btn-sm btn-danger" onClick={() => setPendingRevoke(token)}>
                        <ExternalLink size={14} /> Revoke
                      </button>
                    )}
                    {token.revoked_at && (
                      <Badge tone="neutral">Revoked</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingRevoke)}
        title="Revoke share link"
        message={`Revoke "${pendingRevoke?.name || 'this link'}"? Anyone using it will immediately lose access.`}
        onConfirm={revokeShareToken}
        onCancel={() => setPendingRevoke(null)}
        confirmLabel="Revoke"
        confirmClassName="btn-danger"
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete vehicle"
        message={`Delete ${pendingDelete?.vehicle_id}? This will clear its device assignment and cannot be undone.`}
        onConfirm={remove}
        onCancel={() => setPendingDelete(null)}
        confirmLabel="Delete"
        confirmClassName="btn-danger"
        loading={deleting}
      />
    </>
  );
}
