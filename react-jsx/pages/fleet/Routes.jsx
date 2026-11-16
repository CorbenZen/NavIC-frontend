import { MapPin, Pencil, Plus, Search, Route, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api } from '@services/api';
import { Badge, Card, EmptyState, PageHeader } from '../../components/common';
import { Field, SearchInput } from '../../components/forms';
import { ConfirmDialog, Modal } from '../../components/modals';
import { ErrorBanner, LoadingBlock, useToast } from '../../components/feedback';
import { useFleet } from '@react/hooks/useFleet';

function emptyForm() {
  return {
    name: '',
    identifier: '',
    start_point: '',
    destination: '',
    color: '#0d9488',
    stops: [],
  };
}

function normaliseStops(stops = []) {
  return stops.map((stop) => ({
    name: stop.name || '',
    latitude: stop.latitude == null ? '' : String(stop.latitude),
    longitude: stop.longitude == null ? '' : String(stop.longitude),
  }));
}

export function RoutesPage() {
  const { routes, loading, error, refresh, refreshing } = useFleet();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return routes;
    return routes.filter((route) =>
      [route.name, route.identifier, route.start_point, route.destination]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [routes, query]);

  const openCreate = () => {
    setEditing({ id: null });
    setForm(emptyForm());
    setFormError('');
  };

  const openEdit = (route) => {
    setEditing(route);
    setForm({
      name: route.name || '',
      identifier: route.identifier || '',
      start_point: route.start_point || '',
      destination: route.destination || '',
      color: route.color || '#0d9488',
      stops: normaliseStops(route.stops),
    });
    setFormError('');
  };

  const updateStop = (index, key, value) => {
    setForm((current) => ({
      ...current,
      stops: current.stops.map((stop, stopIndex) => (stopIndex === index ? { ...stop, [key]: value } : stop)),
    }));
  };

  const addStop = () => {
    setForm((current) => ({ ...current, stops: [...current.stops, { name: '', latitude: '', longitude: '' }] }));
  };

  const removeStop = (index) => {
    setForm((current) => ({ ...current, stops: current.stops.filter((_, stopIndex) => stopIndex !== index) }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setFormError('');

    const populated = form.stops.filter(
      (stop) => stop.name.trim() || stop.latitude !== '' || stop.longitude !== '',
    );
    for (const [index, stop] of populated.entries()) {
      const latitude = Number(stop.latitude);
      const longitude = Number(stop.longitude);
      if (!stop.name.trim()) {
        setFormError(`Stop ${index + 1} needs a name.`);
        return;
      }
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
        setFormError(`Stop ${index + 1} needs a latitude between -90 and 90.`);
        return;
      }
      if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        setFormError(`Stop ${index + 1} needs a longitude between -180 and 180.`);
        return;
      }
    }

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      identifier: form.identifier.trim(),
      start_point: form.start_point.trim() || null,
      destination: form.destination.trim() || null,
      color: form.color,
      stops: populated.map((stop) => ({
        name: stop.name.trim(),
        latitude: Number(stop.latitude),
        longitude: Number(stop.longitude),
      })),
    };

    try {
      if (editing?.id) await api.updateRoute(editing.id, payload);
      else await api.createRoute(payload);
      toast.success(editing?.id ? 'Route updated.' : 'Route created.');
      setEditing(null);
      await refresh();
    } catch (saveError) {
      setFormError(saveError.message || 'Could not save the route.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api.deleteRoute(pendingDelete.id);
      toast.success('Route deleted. Assigned vehicles were unassigned from this route.');
      setPendingDelete(null);
      await refresh();
    } catch (deleteError) {
      toast.error(deleteError.message || 'Could not delete the route.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Fleet management"
        title="Routes"
        subtitle="Configure route identity, colour and an ordered stop sequence. Stop coordinates are a configured sequence, not road-network routing directions."
        actions={
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Plus /> Add route
          </button>
        }
      />

      {error ? <ErrorBanner message={error} onRetry={refresh} /> : null}

      <Card actions={<span className="count">{filtered.length} of {routes.length}</span>} flush>
        <div className="filter-bar">
          <SearchInput value={query} onChange={setQuery} placeholder="Search routes…" ariaLabel="Search routes" className="grow" />
        </div>

        {loading && !routes.length ? (
          <LoadingBlock label="Loading routes…" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Route</th>
                  <th>Start / destination</th>
                  <th>Stops</th>
                  <th>Assigned vehicles</th>
                  <th className="actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length ? (
                  filtered.map((route) => (
                    <tr key={route.id}>
                      <td>
                        <span className="row" style={{ gap: 8 }}>
                          <i style={{ width: 10, height: 10, borderRadius: 3, background: route.color || '#0d9488', flex: 'none' }} />
                          <span>
                            <span className="primary">{route.name}</span>
                            <span className="secondary mono">{route.identifier}</span>
                          </span>
                        </span>
                      </td>
                      <td>
                        <span className="primary" style={{ fontWeight: 500 }}>
                          {route.start_point || 'Not recorded'}
                        </span>
                        <span className="secondary">→ {route.destination || 'Not recorded'}</span>
                      </td>
                      <td>
                        <Badge tone={route.stops?.length ? 'info' : 'neutral'}>{route.stops?.length || 0} stop(s)</Badge>
                      </td>
                      <td>
                        {route.assigned_vehicles?.length ? (
                          <span className="row wrap" style={{ gap: 4 }}>
                            {route.assigned_vehicles.map((vehicle) => (
                              <Badge key={vehicle.id} tone="neutral">
                                {vehicle.registration_number}
                              </Badge>
                            ))}
                          </span>
                        ) : (
                          <Badge tone="neutral">None</Badge>
                        )}
                      </td>
                      <td className="actions">
                        <button type="button" className="btn btn-sm" onClick={() => openEdit(route)}>
                          <Pencil /> Edit
                        </button>
                        <button type="button" className="btn btn-sm btn-danger" onClick={() => setPendingDelete(route)}>
                          <Trash2 />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState
                        icon={Route}
                        title={routes.length ? 'No routes match this search' : 'No routes configured'}
                        description={routes.length ? 'Try a different search.' : 'Create a route to group vehicles and produce route activity reports.'}
                        action={
                          !routes.length ? (
                            <button type="button" className="btn btn-sm btn-primary" onClick={openCreate}>
                              <Plus /> Add route
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
        wide
        title={editing?.id ? 'Edit route' : 'Add route'}
        subtitle="The stop order is the configured sequence shown to operators. It does not imply verified road routing."
        onClose={() => setEditing(null)}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="route-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save route'}
            </button>
          </>
        }
      >
        <form id="route-form" onSubmit={submit}>
          <div className="form-grid">
            {formError ? <div className="form-error span-2">{formError}</div> : null}
            <Field label="Route name">
              <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="North campus route" />
            </Field>
            <Field label="Route identifier" hint="Unique code used in reports.">
              <input required value={form.identifier} onChange={(event) => setForm({ ...form, identifier: event.target.value })} placeholder="R-NORTH" />
            </Field>
            <Field label="Starting point">
              <input value={form.start_point} onChange={(event) => setForm({ ...form, start_point: event.target.value })} placeholder="Campus main gate" />
            </Field>
            <Field label="Destination">
              <input value={form.destination} onChange={(event) => setForm({ ...form, destination: event.target.value })} placeholder="North gate" />
            </Field>
            <Field label="Route colour" hint="Used for map and table accents.">
              <input type="color" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} />
            </Field>
          </div>

          <div className="row between" style={{ margin: '20px 0 9px' }}>
            <div>
              <h3 className="section-title">Configured stop sequence</h3>
              <p className="section-sub">Optional. Each stop needs a name, latitude and longitude.</p>
            </div>
            <button type="button" className="btn btn-sm" onClick={addStop}>
              <Plus /> Add stop
            </button>
          </div>

          {form.stops.length ? (
            <div className="stop-list">
              {form.stops.map((stop, index) => (
                <div className="stop-row" key={index}>
                  <span className="stop-index">{index + 1}</span>
                  <input
                    value={stop.name}
                    onChange={(event) => updateStop(index, 'name', event.target.value)}
                    placeholder="Stop name"
                    aria-label={`Stop ${index + 1} name`}
                  />
                  <input
                    value={stop.latitude}
                    onChange={(event) => updateStop(index, 'latitude', event.target.value)}
                    placeholder="Latitude"
                    inputMode="decimal"
                    aria-label={`Stop ${index + 1} latitude`}
                  />
                  <input
                    value={stop.longitude}
                    onChange={(event) => updateStop(index, 'longitude', event.target.value)}
                    placeholder="Longitude"
                    inputMode="decimal"
                    aria-label={`Stop ${index + 1} longitude`}
                  />
                  <button type="button" className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => removeStop(index)} aria-label={`Remove stop ${index + 1}`}>
                    <Trash2 />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '22px 12px', border: '1px dashed var(--line)', borderRadius: 9 }}>
              <div className="empty-icon">
                <MapPin />
              </div>
              <b>No configured stops</b>
              <p>Add stops to document the intended sequence for this route.</p>
            </div>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete route?"
        message={
          pendingDelete
            ? `Delete ${pendingDelete.name}? Vehicles assigned to this route will be unassigned. Telemetry history is not deleted.`
            : ''
        }
        busy={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={remove}
      />
    </>
  );
}
