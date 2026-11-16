import React from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      console.log('[PWA] Service Worker registered:', registration.scope);
      
      // Check for updates periodically
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000); // Every hour
      
      // Listen for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available, notify user
            if (confirm('A new version of NavIC CBTMS is available. Reload to update?')) {
              window.location.reload();
            }
          }
        });
      });
    }).catch((error) => {
      console.error('[PWA] Service Worker registration failed:', error);
    });
  });
  }
  
  // Listen for online/offline events
  window.addEventListener('online', () => {
    document.body.classList.remove('offline');
    const banner = document.getElementById('offline-banner');
    if (banner) banner.remove();
  });
  
  window.addEventListener('offline', () => {
    document.body.classList.add('offline');
    if (!document.getElementById('offline-banner')) {
      const banner = document.createElement('div');
      banner.id = 'offline-banner';
      banner.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: var(--warning, #d97706);
        color: #000;
        padding: 8px 16px;
        text-align: center;
        z-index: 9999;
        font-weight: 600;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      `;
      banner.innerHTML = '📡 You\'re offline. Live data unavailable. Some features may not work.';
      document.body.prepend(banner);
    }
  });

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { failed: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Always log to console
    console.error('ErrorBoundary caught an error:', error, '\nComponent stack:', errorInfo?.componentStack);
  }

  render() {
    if (this.state.failed) {
      // Vite exposes import.meta.env.DEV at build time; in dev server it's true
      const isDev = (typeof import.meta !== 'undefined' && import.meta.env?.DEV) || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      return (
        <div className="runtime-error" role="alert" style={{ padding: 24, maxWidth: 900, margin: '40px auto', background: 'var(--surface, #fff)', border: '1px solid var(--danger, #dc2626)', borderRadius: 12, color: 'var(--ink, #0f1720)' }}>
          <h1 style={{ margin: '0 0 12px', color: 'var(--danger, #dc2626)' }}>The console encountered a rendering error</h1>
          <p style={{ margin: '0 0 16px' }}>Refresh the page to retry. If the problem persists, check the browser console and the API service logs.</p>
          {isDev && this.state.error && (
            <details style={{ textAlign: 'left', background: 'var(--surface-sunken, #f0f2f4)', padding: 16, borderRadius: 8, overflow: 'auto', maxHeight: '60vh' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, marginBottom: 8 }}>Error details (development mode)</summary>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, fontFamily: 'monospace' }}>
                {this.state.error?.message || String(this.state.error)}
                {this.state.errorInfo?.componentStack && '\n\nComponent stack:\n' + this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
          <button type="button" className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => window.location.reload()}>Reload page</button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
