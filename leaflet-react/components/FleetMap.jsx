import { useEffect, useMemo, useRef, useState } from 'react';
import { Map, Navigation } from 'lucide-react';
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip } from 'react-leaflet';
import { hasPosition, STATUS_COLORS, timeAgo } from '@react/utils/format';
import { useFleet } from '@react/hooks/useFleet';
import { DEFAULT_CENTER, DEFAULT_ZOOM, MAP_TILES } from '@leaflet/layers/config';
import { fleetIcon, statusClassName } from '@leaflet/markers/icons';
import { MapController } from '@leaflet/components/MapController';

export function FleetMap({
  vehicles = [],
  selectedId,
  onSelect,
  history = [],
  focus = null,
  fitSignal = 0,
  tile,
  onTileChange,
  height = 420,
  showLegend = true,
  emptyNote,
  // Phase 2.3: Live map upgrades
  trailLength = 50,
  setTrailLength,
  followSelected = false,
  setFollowSelected,
  routeStops = null,
  routeColor = '#0f766e',
}) {
  const { preferences } = useFleet();
  const selectedTile = tile || preferences?.default_map_view || 'streets';
  const mappable = useMemo(() => vehicles.filter(hasPosition), [vehicles]);

  // Track previous status for animation
  const prevStatusRef = useRef({});
  const [animatingVehicles, setAnimatingVehicles] = useState({});
  
  // Track status changes for animation
  const statusChangesRef = useRef({});
  useEffect(() => {
    const newAnimating = {};
    vehicles.forEach(vehicle => {
      const prevStatus = prevStatusRef.current[vehicle.device_id];
      const currentStatus = vehicle.status_key;
      if (prevStatus && prevStatus !== currentStatus) {
        statusChangesRef.current[vehicle.device_id] = currentStatus;
        newAnimating[vehicle.device_id] = true;
      }
    });
    if (Object.keys(newAnimating).length > 0) {
      setAnimatingVehicles(prev => ({ ...prev, ...newAnimating }));
    }
    // Update previous status after checking
    vehicles.forEach(vehicle => {
      prevStatusRef.current[vehicle.device_id] = vehicle.status_key;
    });
    
    // Clear animation after duration
    const timer = setTimeout(() => {
      setAnimatingVehicles({});
      statusChangesRef.current = {};
    }, 600);
    return () => clearTimeout(timer);
  }, [vehicles]);
  
  // Get trail positions for each vehicle from history
  const vehicleTrails = useMemo(() => {
    const trails = {};
    if (trailLength > 0 && history.length) {
      // Group history by device_id
      const byDevice = {};
      history.filter(hasPosition).forEach((point) => {
        if (!byDevice[point.device_id]) byDevice[point.device_id] = [];
        byDevice[point.device_id].push(point);
      });
      
      Object.entries(byDevice).forEach(([deviceId, points]) => {
        // Sort by timestamp ascending
        points.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        // Take last N points
        const trail = points.slice(-trailLength).map(p => [Number(p.latitude), Number(p.longitude)]);
        if (trail.length > 1) trails[deviceId] = trail;
      });
    }
    return trails;
  }, [history, trailLength]);

  const historyPositions = useMemo(
    () => history.filter(hasPosition).map((point) => [Number(point.latitude), Number(point.longitude)]),
    [history],
  );

  const center = mappable.length
    ? [Number(mappable[0].latitude), Number(mappable[0].longitude)]
    : DEFAULT_CENTER;
  const selectedVehicle = mappable.find((vehicle) => vehicle.device_id === selectedId) || mappable[0];
  const selectedStatusKey = selectedVehicle?.status_key || 'out_of_network';
  const selectedStatusColor = STATUS_COLORS[selectedStatusKey] || STATUS_COLORS.out_of_network;
  const activeTile = MAP_TILES[selectedTile] || MAP_TILES.streets;
  const defaultZoom = preferences?.default_map_zoom || DEFAULT_ZOOM;

  // Follow selected vehicle
  const mapRef = useRef(null);
  useEffect(() => {
    // React-Leaflet v5 forwards the Leaflet map itself to MapContainer's ref;
    // the older leafletElement wrapper is no longer present.
    const map = mapRef.current;
    if (followSelected && selectedVehicle && hasPosition(selectedVehicle) && map) {
      map.flyTo(
        [Number(selectedVehicle.latitude), Number(selectedVehicle.longitude)],
        Math.max(map.getZoom(), 14),
        { duration: 0.5 }
      );
    }
  }, [followSelected, selectedVehicle, selectedId]);

  // Route stops overlay
  const routeStopsOverlay = useMemo(() => {
    if (!routeStops || !routeStops.length) return null;
    
    const validStops = routeStops
      .map((stop, index) => ({
        ...stop,
        index,
        lat: Number(stop.latitude),
        lng: Number(stop.longitude),
      }))
      .filter((stop) => Number.isFinite(stop.lat) && Number.isFinite(stop.lng));
    
    if (validStops.length < 2) return null;
    
    const positions = validStops.map((stop) => [stop.lat, stop.lng]);
    return (
      <>
        <Polyline
          positions={positions}
          pathOptions={{ color: routeColor, weight: 3, opacity: 0.7, dashArray: '10, 10' }}
        />
        {validStops.map((stop) => (
          <CircleMarker
            key={stop.index}
            center={[stop.lat, stop.lng]}
            radius={8}
            pathOptions={{
              color: routeColor,
              fillColor: routeColor,
              fillOpacity: 0.9,
              weight: 2,
            }}
          >
            <Tooltip>{stop.name || `Stop ${stop.index + 1}`}</Tooltip>
            <Popup>
              <b>{stop.name || `Stop ${stop.index + 1}`}</b>
              <br />
              <small className="mono">{stop.lat.toFixed(5)}, {stop.lng.toFixed(5)}</small>
            </Popup>
          </CircleMarker>
        ))}
      </>
    );
  }, [routeStops, routeColor]);

  return (
    <div className="map-shell" style={{ height }}>
      <MapContainer
        ref={mapRef}
        center={center}
        zoom={defaultZoom}
        className="map-canvas"
        scrollWheelZoom
      >
        <TileLayer key={selectedTile} url={activeTile.url} attribution={activeTile.attribution} maxZoom={activeTile.maxZoom} />
        <MapController vehicles={mappable} focus={focus} fitSignal={fitSignal} defaultZoom={defaultZoom} />

        {/* Vehicle trails */}
        {Object.entries(vehicleTrails).map(([deviceId, trail]) => {
          const vehicle = mappable.find(v => v.device_id === deviceId);
          const color = vehicle ? (STATUS_COLORS[vehicle.status_key] || STATUS_COLORS.out_of_network) : '#666';
          return (
            <Polyline
              key={`trail-${deviceId}`}
              positions={trail}
              pathOptions={{ color, weight: 2, opacity: 0.6, lineCap: 'round', lineJoin: 'round' }}
            />
          );
        })}

        {/* Recorded history polyline (selected vehicle) */}
        {historyPositions.length > 1 ? (
          <>
            <Polyline positions={historyPositions} pathOptions={{ color: selectedStatusColor, weight: 4, opacity: 0.9 }} />
            <CircleMarker center={historyPositions[0]} radius={5} pathOptions={{ color: selectedStatusColor, fillColor: selectedStatusColor, fillOpacity: 1, weight: 2 }}>
              <Popup>Start of recorded history</Popup>
            </CircleMarker>
            <CircleMarker
              center={historyPositions[historyPositions.length - 1]}
              radius={5}
              pathOptions={{ color: selectedStatusColor, fillColor: selectedStatusColor, fillOpacity: 1, weight: 2 }}
            >
              <Popup>End of recorded history</Popup>
            </CircleMarker>
          </>
        ) : null}

        {/* Route stops overlay */}
        {routeStopsOverlay}

        {mappable.map((vehicle) => {
          const selected = vehicle.device_id === selectedId;
          const isStale = vehicle.status_key === 'out_of_network';
          const isAnimating = animatingVehicles[vehicle.device_id];
          return (
            <Marker
              key={vehicle.device_id}
              position={[Number(vehicle.latitude), Number(vehicle.longitude)]}
              icon={fleetIcon(vehicle.status_key, selected, vehicle.simulated, isStale, isAnimating)}
              eventHandlers={{ click: () => onSelect?.(vehicle) }}
              zIndexOffset={selected ? 1000 : 0}
            >
              <Tooltip className={`fleet-tooltip fleet-tooltip-${statusClassName(vehicle.status_key)} ${isStale ? 'stale' : ''}`}>
                {vehicle.registration_number || vehicle.vehicle_id || vehicle.device_id}
                {isStale ? ' (Stale)' : ''}
              </Tooltip>
              <Popup className={`fleet-popup fleet-popup-${statusClassName(vehicle.status_key)} ${isStale ? 'stale' : ''}`}>
                <b>{vehicle.registration_number || vehicle.vehicle_id || vehicle.device_id}</b>
                <br />
                Driver: {vehicle.driver_name || 'Unassigned'}
                <br />
                Route: {vehicle.route_name || 'Unassigned'}
                <br />
                Status: {vehicle.status || 'Unknown'}
                <br />
                Speed: {vehicle.speed == null ? '—' : `${Number(vehicle.speed).toFixed(1)} km/h`}
                <br />
                Fix: {vehicle.timestamp ? timeAgo(vehicle.timestamp) : 'No timestamp'}
                {vehicle.simulated ? (
                  <>
                    <br />
                    <em>Simulated telemetry</em>
                  </>
                ) : null}
                {isStale ? (
                  <>
                    <br />
                    <em className="text-warning">Stale - no recent telemetry</em>
                  </>
                ) : null}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {onTileChange ? (
        <div className="map-toolbar" role="group" aria-label="Map layer">
          {Object.entries(MAP_TILES).map(([key, value]) => (
            <button type="button" key={key} className={selectedTile === key ? 'active' : ''} onClick={() => onTileChange(key)}>
              {value.label}
            </button>
          ))}
          <span className="map-toolbar-divider" aria-hidden="true" />
          <label className="map-toolbar-label" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <Navigation size={14} style={{ color: 'var(--muted)' }} />
            <select
              className="input input-sm"
              value={trailLength}
              onChange={(e) => setTrailLength?.(Number(e.target.value))}
              style={{ width: 'auto', minWidth: 80, padding: '4px 8px' }}
              aria-label="Trail length"
            >
              <option value={10}>10 fixes</option>
              <option value={50}>50 fixes</option>
              <option value={100}>100 fixes</option>
              <option value={0}>No trail</option>
            </select>
          </label>
          <label className="map-toolbar-label" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <Map size={14} style={{ color: 'var(--muted)' }} />
            <input
              type="checkbox"
              checked={followSelected}
              onChange={(e) => setFollowSelected?.(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: 'var(--brand)' }}
              aria-label="Follow selected vehicle"
            />
            Follow
          </label>
        </div>
      ) : null}

      {emptyNote ? <div className="map-overlay-note">{emptyNote}</div> : null}

      {showLegend ? (
        <div className="map-legend" aria-hidden="true">
          <span>
            <i style={{ background: STATUS_COLORS.on_move }} /> On Move
          </span>
          <span>
            <i style={{ background: STATUS_COLORS.idle }} /> Idle
          </span>
          <span>
            <i style={{ background: STATUS_COLORS.stopped }} /> Stopped
          </span>
          <span>
            <i style={{ background: STATUS_COLORS.out_of_network }} /> Out Of N/w
          </span>
          <span><i style={{ background: STATUS_COLORS.toing }} /> Toing</span>
        </div>
      ) : null}
    </div>
  );
}
