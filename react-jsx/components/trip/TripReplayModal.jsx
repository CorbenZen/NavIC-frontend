import { Play, Pause, Square, SkipBack, SkipForward, FastForward, RotateCcw, Minus, Plus, MapPin, ChevronLeft, ChevronRight, Route } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cx } from '../common/cx';
import { api } from '@services/api';
import { Modal } from '../modals';
import { LoadingBlock } from '../feedback';
import { Badge, EmptyState } from '../common';
import { fmtDateTime, fmtSpeed, timeAgo } from '@react/utils/format';

const SPEED_OPTIONS = [1, 2, 4, 8];

export function TripReplayModal({ isOpen, onClose, trip, onTripChange }) {
  const [fixes, setFixes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Playback state
  const [playing, setPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [speed, setSpeed] = useState(1);
  
  // Refs for animation
  const animationRef = useRef(null);
  const lastTimestampRef = useRef(null);
  const mapRef = useRef(null);
  
  // Computed values
  const currentFix = fixes[currentIndex] || null;
  const progress = fixes.length > 1 ? (currentIndex / (fixes.length - 1)) * 100 : 0;
  const isSimulated = trip?.simulated || fixes.some(f => f.simulated);

  // Load fixes when trip changes
  useEffect(() => {
    if (!trip) return;
    
    const loadFixes = async () => {
      setLoading(true);
      setError('');
      try {
        const tripId = `${trip.device_id}:${trip.trip}`;
        const result = await api.getTripFixes(tripId);
        setFixes(result.fixes || []);
        setCurrentIndex(0);
        setPlaying(false);
      } catch (err) {
        setError(err.message || 'Could not load trip fixes.');
        setFixes([]);
      } finally {
        setLoading(false);
      }
    };
    
    loadFixes();
  }, [trip]);

  // Animation loop
  useEffect(() => {
    if (!playing || fixes.length <= 1) return;
    
    const animate = (timestamp) => {
      if (!lastTimestampRef.current) {
        lastTimestampRef.current = timestamp;
        animationRef.current = requestAnimationFrame(animate);
        return;
      }
      
      const delta = timestamp - lastTimestampRef.current;
      lastTimestampRef.current = timestamp;
      
      // Calculate time to advance based on speed
      // At 1x, 1 second of real time = 1 second of trip time
      // We need to advance through fixes based on their timestamps
      const timeAdvance = delta * speed;
      
      // Find the next fix based on time
      if (currentIndex < fixes.length - 1) {
        const currentTime = new Date(fixes[currentIndex].timestamp).getTime();
        const nextTime = new Date(fixes[currentIndex + 1].timestamp).getTime();
        const timeToNext = nextTime - currentTime;
        
        if (timeAdvance >= timeToNext) {
          // Move to next fix
          setCurrentIndex(prev => Math.min(prev + 1, fixes.length - 1));
        }
      } else {
        // End of trip - loop or stop
        setPlaying(false);
        setCurrentIndex(0);
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [playing, speed, currentIndex, fixes]);

  const togglePlay = useCallback(() => {
    setPlaying(prev => !prev);
    if (!playing) lastTimestampRef.current = null;
  }, [playing]);

  const stop = useCallback(() => {
    setPlaying(false);
    setCurrentIndex(0);
    lastTimestampRef.current = null;
  }, []);

  const stepBack = useCallback(() => {
    setCurrentIndex(prev => Math.max(0, prev - 1));
  }, []);

  const stepForward = useCallback(() => {
    setCurrentIndex(prev => Math.min(fixes.length - 1, prev + 1));
  }, [fixes.length]);

  const setSpeedValue = useCallback((newSpeed) => {
    setSpeed(newSpeed);
  }, []);

  const handleSliderChange = useCallback((e) => {
    const newIndex = Math.round((e.target.value / 100) * (fixes.length - 1));
    setCurrentIndex(Math.max(0, Math.min(fixes.length - 1, newIndex)));
  }, [fixes.length]);

  const formatTime = (ts) => ts ? new Date(ts).toLocaleTimeString() : '—';
  const formatDateTimeFull = (ts) => ts ? new Date(ts).toLocaleString() : '—';

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Trip Replay"
      subtitle={`${trip?.registration_number || trip?.vehicle_id} · Trip #{trip?.trip} · ${fmtDateTime(trip?.start_time)} → ${fmtDateTime(trip?.end_time)}`}
      wide
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={loading}>
            Close
          </button>
        </>
      }
    >
      {error && <div className="error-banner" style={{ marginBottom: 16 }}>{error}</div>}
      
      {loading ? (
        <LoadingBlock label="Loading trip fixes…" />
      ) : fixes.length === 0 ? (
        <EmptyState
          icon={Route}
          title="No fixes for this trip"
          description="This trip has no recorded position fixes."
        />
      ) : (
        <div className="trip-replay-container">
          {/* Map placeholder - in real implementation would use FleetMap */}
          <div className="trip-replay-map" ref={mapRef} style={{ height: 300, background: 'var(--surface-sunken)', borderRadius: 'var(--radius)', position: 'relative', overflow: 'hidden' }}>
            {currentFix && (
              <div className="trip-replay-marker" style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
              }}>
                <MapPin size={24} color="var(--danger)" />
                <div className="small mono" style={{ marginTop: 4 }}>
                  {currentFix.latitude.toFixed(5)}, {currentFix.longitude.toFixed(5)}
                </div>
              </div>
            )}
            <div className="trip-replay-map-info" style={{ position: 'absolute', bottom: 12, left: 12, right: 12, background: 'rgba(0,0,0,0.7)', color: 'white', padding: 12, borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
              <div className="row between">
                <span><b>Fix {currentIndex + 1} of {fixes.length}</b></span>
                <span className="mono">{formatTime(currentFix?.timestamp)}</span>
              </div>
              <div className="row between" style={{ marginTop: 4 }}>
                <span>Speed: <b>{fmtSpeed(currentFix?.speed)}</b></span>
                <span>Course: <b>{currentFix?.course !== undefined ? Math.round(currentFix.course) + '°' : '—'}</b></span>
                {currentFix?.altitude_m !== undefined && <span>Alt: <b>{Math.round(currentFix.altitude_m)}m</b></span>}
              </div>
            </div>
          </div>

          {/* Speed sparkline */}
          <div className="trip-replay-sparkline" style={{ height: 80, marginTop: 12, position: 'relative', background: 'var(--surface-sunken)', borderRadius: 'var(--radius)' }}>
            {fixes.length > 1 && (
              <svg width="100%" height="100%" style={{ display: 'block' }}>
                <defs>
                  <linearGradient id="speedGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.8"/>
                    <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.1"/>
                  </linearGradient>
                </defs>
                <path
                  d={fixes.map((f, i) => {
                    const x = (i / (fixes.length - 1)) * 100;
                    const speed = f.speed || 0;
                    const maxSpeed = Math.max(...fixes.map(f => f.speed || 0), 1);
                    const y = 100 - (speed / maxSpeed) * 80;
                    return `${i === 0 ? 'M' : 'L'} ${x}% ${y}%`;
                  }).join(' ')}
                  stroke="url(#speedGradient)"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Current position marker */}
                {currentFix && (
                  <circle
                    cx={`${progress}%`}
                    cy={`${100 - ((currentFix.speed || 0) / Math.max(...fixes.map(f => f.speed || 0), 1)) * 80}%`}
                    r="5"
                    fill="var(--danger)"
                    stroke="white"
                    strokeWidth="2"
                  />
                )}
              </svg>
            )}
            <div className="sparkline-labels" style={{ position: 'absolute', bottom: 4, left: 8, right: 8, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)' }}>
              <span>Start</span>
              <span>Speed</span>
              <span>End</span>
            </div>
          </div>

          {/* Playback controls */}
          <div className="trip-replay-controls" style={{ marginTop: 16, padding: 16, background: 'var(--surface-soft)', borderRadius: 'var(--radius)' }}>
            {/* Progress slider */}
            <div style={{ marginBottom: 12 }}>
              <input
                type="range"
                min="0"
                max="100"
                value={progress}
                onChange={handleSliderChange}
                onMouseDown={() => setPlaying(false)}
                onMouseUp={() => lastTimestampRef.current = null}
                style={{ width: '100%', cursor: 'pointer' }}
                aria-label="Trip progress"
              />
              <div className="row between" style={{ marginTop: 4, fontSize: 12, color: 'var(--muted)' }}>
                <span>{formatDateTimeFull(fixes[0]?.timestamp)}</span>
                <span>{formatDateTimeFull(fixes[fixes.length - 1]?.timestamp)}</span>
              </div>
            </div>

            {/* Playback buttons */}
            <div className="row" style={{ justifyContent: 'center', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={stepBack}
                disabled={currentIndex === 0 || loading}
                aria-label="Previous fix"
              >
                <SkipBack />
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ minWidth: 80 }}
                onClick={togglePlay}
                disabled={loading || fixes.length <= 1}
                aria-label={playing ? 'Pause' : 'Play'}
              >
                {playing ? <Pause /> : <Play />}
                <span style={{ marginLeft: 6 }}>{playing ? 'Pause' : 'Play'}</span>
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={stepForward}
                disabled={currentIndex >= fixes.length - 1 || loading}
                aria-label="Next fix"
              >
                <SkipForward />
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={stop}
                disabled={currentIndex === 0 && !playing || loading}
                aria-label="Stop and reset"
              >
                <Square />
              </button>

              {/* Speed selector */}
              <div className="row" style={{ marginLeft: 'auto', gap: 8, alignItems: 'center' }}>
                <span className="small muted">Speed:</span>
                <div className="row" style={{ gap: 4 }}>
                  {SPEED_OPTIONS.map(s => (
                    <button
                      key={s}
                      type="button"
                      className={cx('btn btn-sm', speed === s && 'btn-primary')}
                      onClick={() => setSpeedValue(s)}
                      aria-pressed={speed === s}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Current fix info */}
            <div className="row" style={{ marginTop: 16, gap: 24, flexWrap: 'wrap', fontSize: 13, color: 'var(--muted)' }}>
              <div><b>Fix:</b> {currentIndex + 1} / {fixes.length}</div>
              <div><b>Time:</b> {formatDateTimeFull(currentFix?.timestamp)}</div>
              <div><b>Speed:</b> {fmtSpeed(currentFix?.speed)}</div>
              <div><b>Course:</b> {currentFix?.course !== undefined ? Math.round(currentFix.course) + '°' : '—'}</div>
              {currentFix?.ignition !== undefined && <div><b>Ignition:</b> {currentFix.ignition ? 'On' : 'Off'}</div>}
              {currentFix?.altitude_m !== undefined && <div><b>Altitude:</b> {Math.round(currentFix.altitude_m)}m</div>}
            </div>

            {/* Simulated badge */}
            {isSimulated && (
              <div className="row" style={{ marginTop: 12, justifyContent: 'center' }}>
                <Badge tone="warning" dot>
                  <RotateCcw size={14} /> Simulated trip data
                </Badge>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

// Need to add api method for trip fixes
import { apiFetch } from '@services/api';
api.getTripFixes = (tripId) => apiFetch(`/api/reports/trip/${encodeURIComponent(tripId)}/fixes`);
