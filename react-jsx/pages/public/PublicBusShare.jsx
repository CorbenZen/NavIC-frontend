import { Copy, ExternalLink, MapPin, RotateCcw, ShieldAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '@services/api';
import { Badge, Card, EmptyState } from '../../components/common';
import { ErrorBanner, InfoBanner, LoadingBlock, useToast } from '../../components/feedback';
import { fmtSpeed, timeAgo } from '@react/utils/format';
import { FleetMap } from '@leaflet/components';

export function PublicBusShare({ token }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);
  const refreshIntervalRef = useRef(null);
  const tokenRef = useRef(token);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const load = async () => {
    try {
      setLoading(true);
      const result = await api.getPublicBus(tokenRef.current);
      setData(result);
      setError('');
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message || 'Could not load bus data.');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    try {
      const result = await api.getPublicBus(tokenRef.current);
      setData(result);
      setError('');
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message || 'Could not refresh bus data.');
    }
  };

  useEffect(() => {
    const frame = requestAnimationFrame(() => load());
    refreshIntervalRef.current = window.setInterval(() => {
      api.getPublicBusStatus(tokenRef.current)
        .then((status) => {
          setData((prev) => prev ? { ...prev, ...status } : null);
          setLastRefresh(new Date());
        })
        .catch(() => {});
    }, 30000);
    return () => {
      cancelAnimationFrame(frame);
      if (refreshIntervalRef.current) window.clearInterval(refreshIntervalRef.current);
    };
  }, []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard!');
    } catch {
      toast.error('Could not copy link.');
    }
  };

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Bus ${data?.registration_number || data?.vehicle_id} - Live Tracking`,
          text: `Track bus ${data?.registration_number || data?.vehicle_id} in real-time`,
          url: window.location.href,
        });
      } catch {
        // User cancelled
      }
    } else {
      copyLink();
    }
  };

  if (loading && !data) {
    return <LoadingBlock label="Loading bus data…" />;
  }

  if (error) {
    return <ErrorBanner message={error} onRetry={refresh} />;
  }

  if (!data) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Invalid or expired link"
        description="This share link is invalid, has been revoked, or has expired."
      />
    );
  }

  const isStale = data.stale || !data.position;
  const isReplay = data.source === 'test_replay';
  const sourceIsSimulated = data.source === 'simulator' || isReplay || data.source_badge === 'Simulated';
  const sourceLabel = isReplay ? 'Test replay' : sourceIsSimulated ? 'Simulator' : 'Device';

  return (
    <div className="public-bus-page">
      <header className="public-bus-header">
        <div className="public-bus-title">
          <h1>{data.registration_number || data.vehicle_id}</h1>
          <p className="route-name">{data.route_name || 'No route assigned'}</p>
        </div>
        <div className="public-bus-badges">
          {sourceIsSimulated ? (
            <Badge tone="warning" dot>
              <RotateCcw size={12} /> {sourceLabel}
            </Badge>
          ) : (
            <Badge tone="neutral" dot>{sourceLabel}</Badge>
          )}
          {isStale ? (
            <Badge tone="danger" dot>Stale</Badge>
          ) : (
            <Badge tone="success" dot>Live</Badge>
          )}
        </div>
      </header>

      <div className="public-bus-content">
        <Card title="Live Position" subtitle={data.last_update ? `Last update: ${timeAgo(data.last_update)}` : 'No telemetry received'} flush>
          {data.position ? (
            <FleetMap
              vehicles={[{
                device_id: 'shared-bus',
                vehicle_id: data.registration_number,
                registration_number: data.registration_number,
                latitude: data.position.latitude,
                longitude: data.position.longitude,
                speed: data.speed,
                course: data.course,
                status: isStale ? 'Out Of N/w' : 'On Move',
                status_key: isStale ? 'out_of_network' : 'on_move',
                simulated: sourceIsSimulated,
                driver_name: '—',
                route_name: data.route_name,
                timestamp: data.last_update,
              }]}
              height="300"
              showLegend={false}
              emptyNote="No position data available"
            />
          ) : (
            <EmptyState
              icon={MapPin}
              title="No position available"
              description="This bus has not reported a valid position yet."
            />
          )}
        </Card>

        <div className="public-bus-grid">
          <Card title="Status" flush>
            <div className="diag-grid">
              <div className="diag-item">
                <small>Speed</small>
                <b>{fmtSpeed(data.speed)}</b>
              </div>
              <div className="diag-item">
                <small>Course</small>
                <b>{data.course != null ? `${Math.round(data.course)}°` : '—'}</b>
              </div>
              <div className="diag-item">
                <small>Last update</small>
                <b>{data.updated_ago || 'Never'}</b>
              </div>
              <div className="diag-item">
                <small>Source</small>
                <b>{data.source_badge}</b>
              </div>
              {data.position && (
                <>
                  <div className="diag-item">
                    <small>Latitude</small>
                    <b className="mono">{Number(data.position.latitude).toFixed(6)}</b>
                  </div>
                  <div className="diag-item">
                    <small>Longitude</small>
                    <b className="mono">{Number(data.position.longitude).toFixed(6)}</b>
                  </div>
                </>
              )}
            </div>
          </Card>

          <Card title="Vehicle Info" flush>
            <div className="diag-grid">
              <div className="diag-item">
                <small>Registration</small>
                <b>{data.registration_number}</b>
              </div>
              <div className="diag-item">
                <small>Route</small>
                <b>{data.route_name || 'Unassigned'}</b>
              </div>
              <div className="diag-item">
                <small>Status</small>
                <b>{isStale ? 'Stale / No data' : 'Active'}</b>
              </div>
            </div>
          </Card>
        </div>

        <Card title="Share & Refresh" flush>
          <div className="public-bus-actions">
            <button type="button" className="btn btn-primary" onClick={shareLink}>
              <ExternalLink size={14} /> Share this link
            </button>
            <button type="button" className="btn" onClick={copyLink}>
              <Copy size={14} /> Copy link
            </button>
            <button type="button" className="btn" onClick={refresh} disabled={loading}>
              <RotateCcw size={14} style={loading ? { animation: 'spin 0.9s linear infinite' } : undefined} /> Refresh
            </button>
          </div>
          <div className="public-bus-meta">
            <small className="muted">
              Auto-refreshes every 30s. Last refreshed: {lastRefresh ? timeAgo(lastRefresh) : 'just now'}
            </small>
            <div className="public-bus-notice">
              <InfoBanner tone="info">
                <small>
                  <b>Public share page:</b> This page shows only minimal bus information. No driver, device, or internal data is exposed.
                  {isReplay
                    ? ' This bus is showing recorded test-replay data, not live hardware.'
                    : sourceIsSimulated
                      ? ' This bus is running on simulated telemetry.'
                      : ''}
                </small>
              </InfoBanner>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
