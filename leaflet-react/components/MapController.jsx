import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import { hasPosition } from '@react/utils/format';

/**
 * Imperative Leaflet camera controller.
 *
 * React-Leaflet does not fit bounds when the vehicle list arrives asynchronously,
 * so this component owns initial fit, explicit re-fit and per-vehicle focus.
 */
export function MapController({ vehicles, focus, fitSignal, defaultZoom }) {
  const map = useMap();
  const initialFit = useRef(false);

  useEffect(() => {
    let timer = null;
    let attempts = 0;

    const fitInitial = () => {
      if (initialFit.current) return;
      const positions = vehicles.filter(hasPosition).map((row) => [Number(row.latitude), Number(row.longitude)]);
      if (!positions.length) return;
      const size = map.getSize();
      if ((size.x < 40 || size.y < 40) && attempts < 20) {
        attempts += 1;
        timer = window.setTimeout(fitInitial, 120);
        return;
      }
      initialFit.current = true;
      if (positions.length === 1) map.setView(positions[0], 13);
      else map.fitBounds(positions, { padding: [48, 48], maxZoom: 14 });
    };

    if (!initialFit.current) timer = window.setTimeout(fitInitial, 80);
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [map, vehicles]);

  useEffect(() => {
    if (!fitSignal) return;
    const positions = vehicles.filter(hasPosition).map((row) => [Number(row.latitude), Number(row.longitude)]);
    if (positions.length === 1) map.flyTo(positions[0], 14, { duration: 0.7 });
    else if (positions.length > 1) map.flyToBounds(positions, { padding: [48, 48], maxZoom: 14, duration: 0.7 });
  }, [fitSignal, map, vehicles]);

  useEffect(() => {
    if (!focus || !hasPosition(focus)) return;
    map.flyTo([Number(focus.latitude), Number(focus.longitude)], Math.max(map.getZoom(), 14), { duration: 0.8 });
  }, [focus, map]);

  useEffect(() => {
    if (!initialFit.current && !vehicles.some(hasPosition)) map.setView(map.getCenter(), defaultZoom);
  }, [defaultZoom, map, vehicles]);

  useEffect(() => {
    const onResize = () => map.invalidateSize();
    const onLayoutTransitionEnd = () => map.invalidateSize({ pan: false });
    window.addEventListener('resize', onResize);
    window.addEventListener('navic:layout-transition-end', onLayoutTransitionEnd);
    const timer = window.setTimeout(onResize, 250);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('navic:layout-transition-end', onLayoutTransitionEnd);
    };
  }, [map]);

  return null;
}
