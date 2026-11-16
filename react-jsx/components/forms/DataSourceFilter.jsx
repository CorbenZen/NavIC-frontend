import { useFleet } from '@react/hooks/useFleet';

export const DATA_SOURCE_OPTIONS = [
  { value: 'all', label: 'All sources' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'simulator', label: 'Simulated' },
  { value: 'test_replay', label: 'Test replay' },
];

/** Human labels that never present synthetic data as hardware. */
export const DATA_SOURCE_LABELS = {
  hardware: 'Device-reported',
  simulator: 'Simulator',
  test_replay: 'Test replay',
};

/**
 * Resolve the provenance of a row without guessing.
 *
 * Prefers the explicit ``data_source`` returned by the API and falls back to
 * the legacy ``simulated`` flag only for older payloads. Unknown values are
 * treated as hardware so a missing field never hides a real device.
 */
export function rowDataSource(row) {
  const explicit = row?.data_source || row?.device?.data_source || row?.vehicle?.data_source;
  if (explicit === 'hardware' || explicit === 'simulator' || explicit === 'test_replay') return explicit;
  const simulated = row?.simulated ?? row?.device?.simulated ?? row?.vehicle?.simulated;
  return simulated ? 'simulator' : 'hardware';
}

export function matchesDataSource(row, dataSource) {
  if (!dataSource || dataSource === 'all') return true;
  if (Array.isArray(row?.data_sources)) return row.data_sources.includes(dataSource);
  return rowDataSource(row) === dataSource;
}

export function DataSourceFilter({ value, onChange, className = 'input data-source-filter', ariaLabel = 'Filter by data source' }) {
  const fleet = useFleet();
  const current = value ?? fleet.dataSource;
  const change = onChange ?? fleet.setDataSource;
  return (
    <select className={className} value={current} onChange={(event) => change(event.target.value)} aria-label={ariaLabel}>
      {DATA_SOURCE_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
