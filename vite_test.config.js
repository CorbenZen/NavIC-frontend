import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath, URL } from 'node:url';

const PROXIED = [
  '/api', '/buses', '/devices', '/drivers', '/routes', '/auth', '/ws',
  '/alerts', '/settings', '/trips', '/geofences', '/health', '/public',
];

const SPA_ROUTES = new Set(['/devices', '/drivers', '/routes', '/alerts', '/settings', '/trips', '/auth/verify', '/auth/verify-email', '/sign-in', '/sign-up']);

function bypassForSpa(req) {
  const path = req.url?.split('?')[0] || '';
  const wantsHtml = String(req.headers.accept || '').includes('text/html');
  if (wantsHtml && path.startsWith('/public/bus/')) return '/index.html';
  if (SPA_ROUTES.has(path) && wantsHtml) return '/index.html';
  return undefined;
}

export default defineConfig(({ mode }) => {
  const projectRoot = fileURLToPath(new URL('..', import.meta.url));
  const env = loadEnv(mode, projectRoot, '');
  const backend = (env.BACKEND_URL || `http://localhost:${env.PORT || 8000}`).replace(/\/$/, '');
  return {
    base: '/',
    resolve: {
      alias: {
        '@react': fileURLToPath(new URL('./react-jsx', import.meta.url)),
        '@services': fileURLToPath(new URL('./javascript-services', import.meta.url)),
        '@leaflet': fileURLToPath(new URL('./leaflet-react', import.meta.url)),
        '@styles': fileURLToPath(new URL('./css-styles', import.meta.url)),
      },
    },
    build: { outDir: 'vite/build', emptyOutDir: true },
    server: {
      host: '0.0.0.0',
      port: 5174,
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
