import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// API prefixes that Vite forwards to FastAPI during development.
const PROXIED = [
  '/api',
  '/buses',
  '/devices',
  '/drivers',
  '/routes',
  '/auth',
  '/ws',
  '/alerts',
  '/settings',
  '/trips',
  '/geofences',
  '/health',
  '/public',
];

// These API prefixes are also React routes.  A browser navigation (Accept:
// text/html) must be handled by Vite so the SPA can render and refresh, while
// fetch/XHR calls (Accept: application/json) still reach FastAPI.
const SPA_ROUTES = new Set(['/devices', '/drivers', '/routes', '/alerts', '/settings', '/trips', '/geofences', '/auth/verify', '/auth/verify-email', '/sign-in', '/sign-up']);

function bypassForSpa(req) {
  const path = req.url?.split('?')[0] || '';
  const wantsHtml = String(req.headers.accept || '').includes('text/html');
  // A public share URL opened in a browser must render the SPA; the same URL
  // fetched with Accept: application/json is proxied to FastAPI.
  if (wantsHtml && path.startsWith('/public/bus/')) return '/index.html';
  if (SPA_ROUTES.has(path) && wantsHtml) {
    return '/index.html';
  }
  return undefined;
}

export default defineConfig(({ mode }) => {
  const projectRoot = fileURLToPath(new URL('..', import.meta.url));
  const env = loadEnv(mode, projectRoot, '');
  const backend = (env.BACKEND_URL || `http://localhost:${env.PORT || 8000}`).replace(/\/$/, '');
  return {
    // NavIC is served from the domain root locally and by the FastAPI static
    // frontend mount in a production build.
    base: '/',
    resolve: {
      alias: {
        '@react': fileURLToPath(new URL('../react-jsx', import.meta.url)),
        '@services': fileURLToPath(new URL('../javascript-services', import.meta.url)),
        '@leaflet': fileURLToPath(new URL('../leaflet-react', import.meta.url)),
        '@styles': fileURLToPath(new URL('../css-styles', import.meta.url)),
      },
    },
    build: { outDir: 'vite/build', emptyOutDir: true },
    server: {
      host: '0.0.0.0',
      proxy: Object.fromEntries(
        PROXIED.map((path) => [
          path,
          {
            target: backend,
            changeOrigin: true,
            ws: path === '/ws',
            bypass: path === '/ws' ? undefined : bypassForSpa,
          },
        ]),
      ),
    },
  };
});
