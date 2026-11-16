import { Play, Square, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cx } from '../common/cx';
import { api } from '@services/api';
import { fmtTime } from '@react/utils/format';

export function SimulationControl() {
  const [simRunning, setSimRunning] = useState(false);
  const [simSpeed, setSimSpeed] = useState(1);
  const [simState, setSimState] = useState({ running: false, speed_multiplier: 1 });
  const [statusChanges, setStatusChanges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch simulation state periodically
  useEffect(() => {
    const fetchState = async () => {
      try {
        const state = await api.getDemoSimulationState();
        setSimState(state);
        setSimRunning(state.running);
        if (state.last_changes && state.last_changes.length > 0) {
          setStatusChanges(state.last_changes.slice(-5).reverse());
        }
      } catch (err) {
        // Simulation might not be available
        setSimRunning(false);
      }
    };

    fetchState();
    const interval = setInterval(fetchState, 2000);
    return () => clearInterval(interval);
  }, []);

  const startSimulation = async () => {
    setLoading(true);
    setError('');
    try {
      await api.startDemoSimulation(simSpeed);
      setSimRunning(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const stopSimulation = async () => {
    setLoading(true);
    setError('');
    try {
      await api.stopDemoSimulation();
      setSimRunning(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      on_move: '#16a34a',
      stopped: '#dc2626',
      idle: '#0ea5e9',
      out_of_network: '#6b7280',
      toing: '#9333ea',
    };
    return colors[status] || '#6b7280';
  };

  const getStatusLabel = (status) => {
    const labels = {
      on_move: 'On Move',
      stopped: 'Stopped',
      idle: 'Idle',
      out_of_network: 'Out of N/W',
      toing: 'Toing',
    };
    return labels[status] || status;
  };

  // Check if demo simulation is available
  const simAvailable = true; // Could check via API if needed

  if (!simAvailable) {
    return null;
  }

  return (
    <div className="simulation-control" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
      <div className="row between" style={{ marginBottom: 8 }}>
        <span className="small" style={{ fontWeight: 600 }}>
          <Zap size={14} style={{ marginRight: 6 }} /> Simulation
        </span>
        {simState.running && (
          <span className={cx('badge', 'badge-success', 'badge-dot', 'pulse')} style={{ fontSize: 11 }}>
            Running
          </span>
        )}
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className={cx('btn btn-sm', simState.running ? 'btn-ghost' : 'btn-primary')}
          onClick={simState.running ? stopSimulation : startSimulation}
          disabled={loading}
          style={{ minWidth: 70 }}
        >
          {loading ? '…' : simState.running ? <Square size={14} /> : <Play size={14} />}
          <span style={{ marginLeft: 4 }}>{simState.running ? 'Stop' : 'Start'}</span>
        </button>

        <div className="row" style={{ gap: 4, alignItems: 'center' }}>
          <span className="small muted" style={{ whiteSpace: 'nowrap' }}>Speed:</span>
          <div className="row" style={{ gap: 4 }}>
            {[1, 2, 4].map((speed) => (
              <button
                key={speed}
                type="button"
                className={cx('btn btn-xs', simSpeed === speed ? 'btn-primary' : 'btn-ghost')}
                onClick={() => setSimSpeed(speed)}
                disabled={loading}
                aria-pressed={simSpeed === speed}
              >
                {speed}×
              </button>
            ))}
          </div>
        </div>
      </div>

      {simState.running && (
        <div className="simulation-status" style={{ marginTop: 8 }}>
          <div className="row between small" style={{ marginBottom: 4 }}>
            <span>Status</span>
            <span style={{ fontWeight: 500 }}>{simState.running ? 'Running' : 'Stopped'}</span>
          </div>
          <div className="row between small" style={{ marginBottom: 4 }}>
            <span>Vehicles</span>
            <span>{simState.devices?.length || 0}</span>
          </div>
          <div className="row between small" style={{ marginBottom: 4 }}>
            <span>Speed</span>
            <span>{simState.speed_multiplier || 1}×</span>
          </div>
          {simState.auto_stop_at && (
            <div className="row between small" style={{ marginBottom: 4 }}>
              <span>Auto-stop</span>
              <span>{new Date(simState.auto_stop_at).toLocaleTimeString()}</span>
            </div>
          )}
        </div>
      )}

      {statusChanges.length > 0 && (
        <div className="status-changes" style={{ marginTop: 8 }}>
          <div className="small muted" style={{ marginBottom: 4 }}>Recent status changes</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 11 }}>
            {statusChanges.map((change, idx) => (
              <li key={idx} className="row between" style={{ gap: 8, padding: '2px 0' }}>
                <span className={cx('status-dot')} style={{
                  backgroundColor: getStatusColor(change.to),
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  flexShrink: 0,
                }} />
                <span className="small" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <b>{change.device_id}</b>: {getStatusLabel(change.from)} → {getStatusLabel(change.to)}
                </span>
                <span className="small muted" style={{ whiteSpace: 'nowrap' }}>
                  {change.timestamp ? fmtTime(change.timestamp) : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="form-error" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}
    </div>
  );
}