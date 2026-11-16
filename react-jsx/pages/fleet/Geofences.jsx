import { AlertCircle, CheckCircle, Edit, Map as MapIcon, MapPin, Plus, RotateCcw, Search, Trash2, X, XCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { Circle, MapContainer, Marker, Popup, TileLayer, Tooltip, useMapEvents } from 'react-leaflet';
import { api } from '@services/api';
import { Badge, Card, EmptyState, PageHeader } from '../../components/common';
import { Field, SearchInput } from '../../components/forms';
import { ConfirmDialog, Modal } from '../../components/modals';
import { ErrorBanner, LoadingBlock, useToast } from '../../components/feedback';
import { useFleet } from '@react/hooks/useFleet';
import { fmtDateTime, timeAgo } from '@react/utils/format';

const DEFAULT_CENTER = [13.0435, 77.62]; // Bengaluru (HKBK demo area)
const DEFAULT_ZOOM = 13;
const HYSTERESIS_FIXES = 2;

function isValidLatLng(lat, lng) {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
  const latitude = Number(lat);
  const longitude = Number(lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}

const MAP_TILES = {
  streets: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    label: 'Streets',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri',
    label: 'Satellite',
  },
};

function emptyForm() {
  return { name: '', latitude: DEFAULT_CENTER[0], longitude: DEFAULT_CENTER[1], radius_m: 200, active: true };
}

/** Click handler for draw mode (must be a child of MapContainer). */
function DrawClickHandler({ drawing, onPick }) {
  useMapEvents({
    click(event) {
      if (drawing) onPick([event.latlng.lat, event.latlng.lng]);
    },
  });
  return null;
}

/** Imperative camera controller: `center`/`zoom` props alone do not move Leaflet after mount. */
function MapFocus({ center, zoom, signal }) {
  const map = useMapEvents({});
  useEffect(() => {
    if (signal && center && Array.isArray(center) && center.length === 2 && Number.isFinite(center[0]) && Number.isFinite(center[1]) && Number.isFinite(zoom)) {
      map.flyTo(center, zoom, { duration: 0.6 });
    }
  }, [signal, center, zoom, map]);
  return null;
}

export function Geofences() {
  const { geofences: fleetGeofences, loading: fleetLoading, refresh } = useFleet();
  const geofences = fleetGeofences || [];
  const toast = useToast();
  const [selectedId, setSelectedId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
  const [focusSignal, setFocusSignal] = useState(0);
  const [tileLayer, setTileLayer] = useState('streets');
  const [drawing, setDrawing] = useState(false);
  const [drawCenter, setDrawCenter] = useState(null);
  const [drawRadius, setDrawRadius] = useState(200);
  const [query, setQuery] = useState('');
  const [incidents, setIncidents] = useState([]);
  const [incidentsLoading, setIncidentsLoading] = useState(false);
  const [incidentsError, setIncidentsError] = useState('');
  const [incidentStateFilter, setIncidentStateFilter] = useState('');
  const [incidentUnreadOnly, setIncidentUnreadOnly] = useState(false);
  const [showIncidents, setShowIncidents] = useState(false);
  const mapRef = useRef(null);

  const loadIncidents = useCallback(async () => {
    if (!showIncidents) return;
    setIncidentsLoading(true);
    setIncidentsError('');
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (incidentStateFilter) params.set('state', incidentStateFilter);
      if (incidentUnreadOnly) params.set('unread_only', 'true');
      const result = await api.getGeofenceIncidents(`?${params.toString()}`);
      setIncidents(Array.isArray(result?.incidents) ? result.incidents : []);
    } catch (err) {
      setIncidentsError(err);
    } finally {
      setIncidentsLoading(false);
    }
  }, [showIncidents, incidentStateFilter, incidentUnreadOnly]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => loadIncidents());
    return () => cancelAnimationFrame(frame);
  }, [loadIncidents]);

  const handleMapClick = (latlng) => {
    setDrawCenter(latlng);
    setForm((current) => ({ ...current, latitude: latlng[0], longitude: latlng[1] }));
  };

  const startDrawing = () => {
    setDrawing(true);
    setDrawCenter([form.latitude, form.longitude]);
    setDrawRadius(form.radius_m);
  };

  const cancelDrawing = () => {
    setDrawing(false);
    setDrawCenter(null);
  };

  const finishDrawing = () => {
    if (drawCenter) {
      setForm((current) => ({
        ...current,
        latitude: drawCenter[0],
        longitude: drawCenter[1],
        radius_m: drawRadius,
      }));
    }
    setDrawing(false);
    setDrawCenter(null);
  };

  const openCreate = () => {
    setEditing({ id: null });
    setForm(emptyForm());
    setFormError('');
  };

  const openEdit = (geofence) => {
    setEditing(geofence);
    setForm({
      name: geofence.name || '',
      latitude: geofence.latitude,
      longitude: geofence.longitude,
      radius_m: geofence.radius_m,
      active: geofence.active,
    });
    setFormError('');
    focusOn([geofence.latitude, geofence.longitude], 16);
  };

  const focusOn = (center, zoom) => {
    setMapCenter(center);
    setMapZoom(zoom);
    setFocusSignal((value) => value + 1);
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    const payload = {
      name: form.name.trim(),
      latitude: form.latitude,
      longitude: form.longitude,
      radius_m: form.radius_m,
      active: form.active,
    };
    try {
      if (editing?.id) await api.updateGeofence(editing.id, payload);
      else await api.createGeofence(payload);
      toast.success(editing?.id ? 'Geofence updated.' : 'Geofence created.');
      setEditing(null);
      await refresh();
    } catch (saveError) {
      setFormError(saveError.message || 'Could not save the geofence.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api.deleteGeofence(pendingDelete.id);
      toast.success('Geofence deleted.');
      setPendingDelete(null);
      await refresh();
    } catch (deleteError) {
      toast.error(deleteError.message || 'Could not delete the geofence.');
    } finally {
      setDeleting(false);
    }
  };

  const markIncidentRead = async (incidentId) => {
    try {
      await api.markGeofenceIncidentRead(incidentId);
      setIncidents((current) => current.map((inc) => (inc.id === incidentId ? { ...inc, is_read: true } : inc)));
    } catch (err) {
      toast.error(err.message || 'Could not mark incident as read.');
    }
  };

  const markAllIncidentsRead = async () => {
    setIncidentsLoading(true);
    try {
      await api.markAllGeofenceIncidentsRead();
      setIncidents((current) => current.map((inc) => ({ ...inc, is_read: true })));
      toast.success('All geofence incidents marked read.');
    } catch (err) {
      toast.error(err.message || 'Could not mark incidents as read.');
    } finally {
      setIncidentsLoading(false);
    }
  };

  const fitToGeofence = (geofence) => {
    if (!geofence || !isValidLatLng(geofence.latitude, geofence.longitude)) return;
    setSelectedId(geofence.id);
    focusOn(
      [Number(geofence.latitude), Number(geofence.longitude)],
      planZoomForRadius(geofence.radius_m)
    );
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return geofences;
    return geofences.filter((g) => String(g.name || '').toLowerCase().includes(needle));
  }, [geofences, query]);

  const unreadIncidents = incidents.filter((incident) => !incident.is_read).length;

  return (
    <>
      <PageHeader
        eyebrow="Fleet management"
        title="Geofences"
        subtitle={`Circular zones. Entry/exit transitions create incidents after ${HYSTERESIS_FIXES} consecutive fixes (hysteresis).`}
        actions={
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Plus /> Add geofence
          </button>
        }
      />

      {fleetLoading && !geofences.length ? <LoadingBlock label="Loading geofences…" /> : null}

      <div className="geofences-layout">
        <aside className="geofences-sidebar">
          <Card title="Geofences" subtitle={`${filtered.length} of ${geofences.length} defined`} flush>
            <div className="geofence-search">
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Filter by name…"
                ariaLabel="Filter geofences by name"
                className="grow"
              />
            </div>
            <div className="geofence-list">
              {fleetLoading && !geofences.length ? (
                <LoadingBlock label="Loading geofences…" />
              ) : filtered.length ? (
                filtered.map((g) => (
                  <div
                    key={g.id}
                    className={`geofence-row ${selectedId === g.id ? 'active' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => fitToGeofence(g)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        fitToGeofence(g);
                      }
                    }}
                  >
                    <div className="geofence-row-info">
                      <b>{g.name}</b>
                      <div className="row small muted geofence-row-meta">
                        <span>
                          <MapPin size={12} aria-hidden="true" /> {Number(g.latitude).toFixed(5)}, {Number(g.longitude).toFixed(5)}
                        </span>
                        <span>{Math.round(g.radius_m)} m</span>
                        <Badge tone={g.active ? 'success' : 'neutral'} dot>
                          {g.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                    <div className="row geofence-row-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEdit(g);
                        }}
                        aria-label={`Edit ${g.name}`}
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost btn-danger"
                        onClick={(event) => {
                          event.stopPropagation();
                          setPendingDelete(g);
                        }}
                        aria-label={`Delete ${g.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState
                  icon={MapPin}
                  title={query ? 'No geofences match this search' : 'No geofences defined'}
                  description={query ? 'Clear the search to see every geofence.' : 'Create your first geofence to monitor entry/exit events.'}
                  action={
                    query ? (
                      <button type="button" className="btn btn-sm" onClick={() => setQuery('')}>
                        Clear search
                      </button>
                    ) : (
                      <button type="button" className="btn btn-sm btn-primary" onClick={openCreate}>
                        <Plus /> Add geofence
                      </button>
                    )
                  }
                />
              )}
            </div>
          </Card>
        </aside>

        <div className="geofences-map-panel">
          <div className="geofences-map-view">
          <MapContainer ref={mapRef} center={mapCenter} zoom={mapZoom} scrollWheelZoom>
            <TileLayer url={MAP_TILES[tileLayer].url} attribution={MAP_TILES[tileLayer].attribution} />
            <MapFocus center={mapCenter} zoom={mapZoom} signal={focusSignal} />
            <DrawClickHandler drawing={drawing} onPick={handleMapClick} />

            {geofences
              .filter((g) => g.active && isValidLatLng(g.latitude, g.longitude) && Number.isFinite(g.radius_m) && g.radius_m > 0)
              .map((g) => (
                <Circle
                  key={g.id}
                  center={[Number(g.latitude), Number(g.longitude)]}
                  radius={Number(g.radius_m)}
                  pathOptions={{
                    color: 'var(--brand, #0d9488)',
                    fillColor: 'var(--brand, #0d9488)',
                    fillOpacity: g.id === selectedId ? 0.28 : 0.12,
                    weight: g.id === selectedId ? 3 : 2,
                    dashArray: '8, 8',
                  }}
                  eventHandlers={{ click: () => fitToGeofence(g) }}
                >
                  <Tooltip>{g.name}</Tooltip>
                  <Popup>
                    <b>{g.name}</b>
                    <br />
                    Radius: {Math.round(Number(g.radius_m))} m
                    <br />
                    <button type="button" className="btn btn-sm" onClick={() => fitToGeofence(g)}>
                      Centre map
                    </button>
                  </Popup>
                </Circle>
              ))}

            {drawing && drawCenter && isValidLatLng(drawCenter[0], drawCenter[1]) && Number.isFinite(drawRadius) && drawRadius > 0 ? (
              <>
                <Marker
                  position={drawCenter}
                  icon={L.divIcon({
                    className: 'draw-center-marker',
                    html: '<div class="draw-center-dot"></div>',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10],
                  })}
                />
                <Circle
                  center={[Number(drawCenter[0]), Number(drawCenter[1])]}
                  radius={Number(drawRadius)}
                  pathOptions={{ color: 'var(--brand, #0d9488)', fillColor: 'var(--brand, #0d9488)', fillOpacity: 0.15, weight: 2, dashArray: '6, 6' }}
                />
              </>
            ) : null}
          </MapContainer>

          <div className="map-toolbar">
            <label className="map-toolbar-label">
              <MapIcon size={14} aria-hidden="true" />
              <select
                className="input input-sm"
                value={tileLayer}
                onChange={(event) => setTileLayer(event.target.value)}
                aria-label="Map tiles"
              >
                {Object.entries(MAP_TILES).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="map-toolbar-actions">
              {selectedId ? (
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setSelectedId(null)}>
                  <X size={14} /> Clear selection
                </button>
              ) : null}
              <button type="button" className="btn btn-sm" onClick={startDrawing} disabled={drawing}>
                <MapPin size={14} /> Draw
              </button>
              <button type="button" className="btn btn-sm" onClick={() => focusOn(DEFAULT_CENTER, DEFAULT_ZOOM)}>
                <RotateCcw size={14} /> Reset view
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setShowIncidents((value) => !value)}
                aria-pressed={showIncidents}
              >
                <AlertCircle size={14} /> Incidents {showIncidents && unreadIncidents ? `(${unreadIncidents})` : ''}
              </button>
            </div>
          </div>
          </div>

          {showIncidents ? (
            <div className="incidents-panel">
              <div className="incidents-panel-header">
                <h4>
                  Geofence incidents <Badge tone="warning">{unreadIncidents}</Badge>
                </h4>
                <div className="row incidents-panel-actions">
                  <select
                    className="input input-sm"
                    value={incidentStateFilter}
                    onChange={(event) => setIncidentStateFilter(event.target.value)}
                    aria-label="Filter incidents by state"
                  >
                    <option value="">All states</option>
                    <option value="inside">Entry</option>
                    <option value="outside">Exit</option>
                  </select>
                  <label className="check small">
                    <input
                      type="checkbox"
                      checked={incidentUnreadOnly}
                      onChange={(event) => setIncidentUnreadOnly(event.target.checked)}
                    />{' '}
                    Unread only
                  </label>
                  <button type="button" className="btn btn-sm" onClick={loadIncidents} disabled={incidentsLoading}>
                    <RotateCcw size={12} className={incidentsLoading ? 'spin' : undefined} /> Refresh
                  </button>
                  {unreadIncidents > 0 ? (
                    <button type="button" className="btn btn-sm btn-primary" onClick={markAllIncidentsRead} disabled={incidentsLoading}>
                      <CheckCircle size={12} /> Mark all read
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="incidents-panel-body">
                {incidentsLoading ? (
                  <LoadingBlock label="Loading incidents…" />
                ) : incidentsError ? (
                  <ErrorBanner message={incidentsError} onRetry={loadIncidents} resource="geofence incidents" />
                ) : incidents.length ? (
                  incidents.map((inc) => (
                    <div key={inc.id} className={`incident-row ${inc.is_read ? '' : 'unread'}`}>
                      <div className={`incident-icon ${inc.state}`}>
                        {inc.state === 'inside' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                      </div>
                      <div className="incident-body">
                        <div className="row between">
                          <b>{inc.geofence_name}</b>
                          <Badge tone={inc.state === 'inside' ? 'success' : 'warning'}>
                            {inc.state === 'inside' ? 'Entry' : 'Exit'}
                          </Badge>
                        </div>
                        <div className="row small muted incident-meta">
                          <span>{inc.vehicle_reg || inc.device_name || 'Unknown device'}</span>
                          <span>
                            {fmtDateTime(inc.transitioned_at)} · {timeAgo(inc.transitioned_at)}
                          </span>
                        </div>
                      </div>
                      {!inc.is_read ? (
                        <button type="button" className="btn btn-sm btn-ghost" onClick={() => markIncidentRead(inc.id)}>
                          <CheckCircle size={14} /> Mark read
                        </button>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="empty-inline">No incidents match the current filters.</p>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <Modal
        open={Boolean(editing)}
        title={editing?.id ? 'Edit geofence' : 'Add geofence'}
        subtitle={drawing ? 'Click the map to set the centre, or edit the values below.' : 'Draw on the map or enter values manually.'}
        onClose={() => {
          setEditing(null);
          setDrawing(false);
          setFormError('');
        }}
        footer={
          <>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setEditing(null);
                setDrawing(false);
              }}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" form="geofence-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save geofence'}
            </button>
          </>
        }
      >
        <form id="geofence-form" className="form-grid" onSubmit={submit}>
          {formError ? <div className="form-error span-2">{formError}</div> : null}

          {drawing ? (
            <div className="drawing-notice span-2">
              <MapPin size={16} /> Click the map to set the centre. Radius: {drawRadius} m
              <span className="grow" />
              <button type="button" className="btn btn-sm btn-primary" onClick={finishDrawing}>
                Done
              </button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={cancelDrawing}>
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-sm span-2" onClick={startDrawing}>
              <Search size={14} /> Pick centre on the map
            </button>
          )}

          <Field label="Name">
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
              maxLength={120}
            />
          </Field>
          <Field label="Radius (metres)">
            <input
              type="number"
              min="10"
              max="100000"
              value={form.radius_m}
              onChange={(event) => {
                const value = Number.parseInt(event.target.value, 10);
                if (!Number.isNaN(value)) {
                  setForm({ ...form, radius_m: value });
                  setDrawRadius(value);
                }
              }}
              required
            />
          </Field>
          <Field label="Latitude">
            <input
              type="number"
              step="0.000001"
              min="-90"
              max="90"
              value={form.latitude}
              onChange={(event) => setForm({ ...form, latitude: Number.parseFloat(event.target.value) || 0 })}
              required
            />
          </Field>
          <Field label="Longitude">
            <input
              type="number"
              step="0.000001"
              min="-180"
              max="180"
              value={form.longitude}
              onChange={(event) => setForm({ ...form, longitude: Number.parseFloat(event.target.value) || 0 })}
              required
            />
          </Field>
          <Field label="Active" className="span-2">
            <label className="check">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm({ ...form, active: event.target.checked })}
              />{' '}
              Enabled
            </label>
          </Field>
          <p className="muted small span-2">
            Transitions require {HYSTERESIS_FIXES} consecutive fixes inside/outside, so a single noisy fix does not
            create an incident.
          </p>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete geofence"
        message={`Delete ${pendingDelete?.name}? This also removes its recorded state and incidents.`}
        onConfirm={remove}
        onCancel={() => setPendingDelete(null)}
        confirmLabel="Delete"
        confirmClassName="btn-danger"
        loading={deleting}
      />
    </>
  );
}

/** Pick a zoom level that keeps a circle of `radiusMetres` comfortably visible. */
function planZoomForRadius(radiusMetres) {
  const radius = Math.max(10, Number(radiusMetres) || 200);
  return Math.max(12, Math.min(18, Math.round(18 - Math.log2(radius / 100))));
}
