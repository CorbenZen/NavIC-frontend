/**
 * Map tile providers and the default camera.
 *
 * These values are configuration rather than React components, so they live in
 * `leaflet-react/layers/` and `leaflet-react/components/`.
 */
export const MAP_TILES = {
  streets: {
    label: 'Streets',
    url: import.meta.env.VITE_MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      import.meta.env.VITE_MAP_ATTRIBUTION ||
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  satellite: {
    label: 'Satellite',
    url:
      import.meta.env.VITE_MAP_SATELLITE_URL ||
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    maxZoom: 19,
  },
};

export const DEFAULT_CENTER = [13.0405, 77.62];
export const DEFAULT_ZOOM = 12;
