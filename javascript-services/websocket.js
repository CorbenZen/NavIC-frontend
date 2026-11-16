import { locationSocketUrl } from './api';

/**
 * Reconnecting JSON WebSocket client for the fleet console.
 *
 * The hook only receives parsed messages; connection lifecycle, exponential
 * backoff and the keep-alive `ping` frame stay in this service. That keeps
 * `FleetContext` focused on merging telemetry into application state.
 */
export function createRealtimeSocket({
  onStatus,
  onMessage,
  onOpen,
  pingIntervalMs = 25000,
  maxRetryMs = 30000,
}) {
  let socket = null;
  let retryTimer = null;
  let pingTimer = null;
  let attempt = 0;
  let closed = false;

  const connect = () => {
    if (closed) return;
    onStatus?.(attempt === 0 ? 'connecting' : 'reconnecting');
    const url = locationSocketUrl();
    if (!url) {
      onStatus?.('offline');
      return;
    }
    try {
      socket = new WebSocket(url);
    } catch {
      onStatus?.('offline');
      return;
    }

    socket.onopen = () => {
      attempt = 0;
      onStatus?.('online');
      onOpen?.();
    };

    socket.onmessage = (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      onMessage?.(message);
    };

    socket.onclose = () => {
      if (closed) return;
      onStatus?.('offline');
      attempt += 1;
      retryTimer = window.setTimeout(connect, Math.min(maxRetryMs, 1000 * 2 ** Math.min(attempt, 5)));
    };

    socket.onerror = () => {
      try {
        socket?.close();
      } catch {
        /* the close handler owns reconnection */
      }
    };
  };

  connect();
  pingTimer = window.setInterval(() => {
    if (socket?.readyState === WebSocket.OPEN) socket.send('ping');
  }, pingIntervalMs);

  return {
    close() {
      closed = true;
      window.clearTimeout(retryTimer);
      window.clearInterval(pingTimer);
      try {
        socket?.close();
      } catch {
        /* already closed */
      }
    },
    get readyState() {
      return socket?.readyState;
    },
  };
}
