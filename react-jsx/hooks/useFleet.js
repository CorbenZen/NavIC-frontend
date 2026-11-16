import { useContext } from 'react';
import { FleetContext } from '../context/FleetContext';

/**
 * Access the shared fleet/auth state provided by <FleetProvider>.
 *
 * Pages and components use this hook instead of creating their own polling
 * loops; it exposes the latest fleet snapshot, WebSocket state and refresh
 * helpers.
 */
export function useFleet() {
  const context = useContext(FleetContext);
  if (!context) throw new Error('useFleet must be used inside FleetProvider');
  return context;
}
