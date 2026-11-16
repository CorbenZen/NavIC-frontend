/* Page and fleet search dialog; page results come from nav config and entity
 * results come from the live FleetContext collections. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Car, UserRound, Route, Cpu } from 'lucide-react';
import { cx } from '../common/cx';
import { SearchInput } from '../forms';
import { useFleet } from '@react/hooks/useFleet';
import { NAV_ITEMS, canAccessPath } from '@react/utils/navigation';
import { searchShortcutLabel } from '@react/utils/searchShortcut';

const SECTIONS = [
  { key: 'pages', label: 'Pages', icon: NAV_ITEMS[0].icon },
  { key: 'vehicles', label: 'Vehicles', icon: Car },
  { key: 'drivers', label: 'Drivers', icon: UserRound },
  { key: 'routes', label: 'Routes', icon: Route },
  { key: 'devices', label: 'Devices', icon: Cpu },
];

export function CommandPalette({ onClose, navigate }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const { vehicles, drivers, routes, devices, user } = useFleet();

  const userRole = user?.role || 'viewer';

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return NAV_ITEMS.filter((item) => canAccessPath(item.path, userRole)).map((item) => ({
        ...item, description: item.subtitle, type: 'page', section: 'pages',
      }));
    }

    const results = [];

    // Pages
    for (const page of NAV_ITEMS) {
      if (!canAccessPath(page.path, userRole)) continue;
      const item = { ...page, description: page.subtitle, type: 'page', section: 'pages' };
      const haystack = `${item.label} ${item.description}`.toLowerCase();
      if (haystack.includes(needle)) {
        results.push({ ...item, type: 'page', section: 'pages' });
      }
    }

    // Vehicles
    for (const vehicle of vehicles) {
      const haystack = `${vehicle.vehicle_id} ${vehicle.registration_number || ''} ${vehicle.driver_name || ''}`.toLowerCase();
      if (haystack.includes(needle)) {
        results.push({
          type: 'vehicle',
          section: 'vehicles',
          label: vehicle.registration_number || vehicle.vehicle_id,
          description: `${vehicle.vehicle_id} · ${vehicle.driver_name || 'Unassigned'}`,
          icon: Car,
          path: `/vehicles`,
          vehicleId: vehicle.vehicle_id,
        });
      }
    }

    // Drivers
    for (const driver of drivers) {
      const haystack = `${driver.name} ${driver.email || ''}`.toLowerCase();
      if (haystack.includes(needle)) {
        results.push({
          type: 'driver',
          section: 'drivers',
          label: driver.name,
          description: driver.email || 'No email',
          icon: UserRound,
          path: `/drivers`,
          driverId: driver.id,
        });
      }
    }

    // Routes
    for (const route of routes) {
      const haystack = `${route.name} ${route.identifier || ''} ${route.start_point || ''} ${route.destination || ''}`.toLowerCase();
      if (haystack.includes(needle)) {
        results.push({
          type: 'route',
          section: 'routes',
          label: route.name,
          description: `${route.identifier} · ${route.start_point || ''} → ${route.destination || ''}`,
          icon: Route,
          path: `/routes`,
          routeId: route.id,
        });
      }
    }

    // Devices
    for (const device of devices) {
      const haystack = `${device.device_id} ${device.device_type || ''} ${device.identity?.registration_number || ''} ${device.identity?.vehicle_id || ''}`.toLowerCase();
      if (haystack.includes(needle)) {
        results.push({
          type: 'device',
          section: 'devices',
          label: device.device_id,
          description: `${device.device_type} · ${device.identity?.registration_number || device.identity?.vehicle_id || 'Unassigned'}`,
          icon: Cpu,
          path: `/devices`,
          deviceId: device.device_id,
        });
      }
    }

    return results;
  }, [query, vehicles, drivers, routes, devices, userRole]);

  const groupedItems = useMemo(() => {
    const groups = {};
    for (const item of filteredItems) {
      if (!groups[item.section]) groups[item.section] = [];
      groups[item.section].push(item);
    }
    return groups;
  }, [filteredItems]);

  const flatItems = useMemo(() => {
    const flat = [];
    for (const section of SECTIONS) {
      if (groupedItems[section.key]) {
        flat.push({ ...section, isSection: true });
        flat.push(...groupedItems[section.key]);
      }
    }
    return flat;
  }, [groupedItems]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatItems.length - 1));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const item = flatItems[selectedIndex];
        if (item && !item.isSection) {
          if (item.path) navigate(item.path);
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [flatItems, selectedIndex, navigate, onClose]);

  useEffect(() => {
    const selectedItem = listRef.current?.querySelector('[data-selected="true"]');
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, flatItems]);

  const handleItemClick = (item) => {
    if (item.isSection) return;
    if (item.path) navigate(item.path);
    onClose();
  };

  return (
    <div className="command-palette-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="command-palette" onClick={(e) => e.stopPropagation()} ref={listRef}>
        <div className="command-palette-header">
          <div className="command-palette-search">
            <SearchInput
              inputRef={inputRef}
              value={query}
              onChange={(value) => { setQuery(value); setSelectedIndex(0); }}
              placeholder="Search pages, vehicles, drivers, routes, devices…"
              ariaLabel="Command palette search"
              autoComplete="off"
            />
            <kbd className="command-palette-hint">{searchShortcutLabel()}</kbd>
          </div>
        </div>

        <div className="command-palette-content">
          {flatItems.length === 0 ? (
            <div className="command-palette-empty">No matches found</div>
          ) : (
            <ul className="command-palette-list" role="listbox">
              {flatItems.map((item, index) => (
                <li
                  key={`${item.section || item.type}-${index}`}
                  className={cx('command-palette-item', item.isSection && 'section', index === selectedIndex && 'selected')}
                  data-selected={index === selectedIndex}
                  role="option"
                  aria-selected={index === selectedIndex}
                  onClick={() => handleItemClick(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  {item.isSection ? (
                    <span className="command-palette-section-label">{item.label}</span>
                  ) : (
                    <>
                      <item.icon className="command-palette-item-icon" aria-hidden="true" />
                      <div className="command-palette-item-text">
                        <span className="command-palette-item-label">{item.label}</span>
                        <span className="command-palette-item-description">{item.description}</span>
                      </div>
                      <ChevronRight className="command-palette-item-chevron" aria-hidden="true" />
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
