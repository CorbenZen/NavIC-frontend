/**
 * NavIC CBTMS Service Worker
 * Caches app shell only - NO API responses or WebSocket data
 */

// Bump this name whenever caching behaviour changes: activate() deletes every
// other cache, so devices drop pages saved by older service workers.
const CACHE_NAME = 'navic-cbtms-v4-shell';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json?v=3',
  '/logo.png',
  '/tab.png',
  '/favicon.ico?v=6',
  '/favicon-32.png?v=6',
  '/apple-touch-icon.png?v=3',
  '/icon-192.png?v=3',
  '/icon-512.png?v=3',
  '/icon-192-maskable.png?v=3',
  '/icon-512-maskable.png?v=3',
  '/images/logo.png',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching app shell');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip API requests - never cache API responses
  if (url.pathname.startsWith('/api/') || 
      url.pathname.startsWith('/auth/') ||
      url.pathname.startsWith('/ws/') ||
      url.pathname === '/health') {
    // Let these go to network directly
    return;
  }
  
  // Skip WebSocket upgrade requests
  if (event.request.headers.get('upgrade') === 'websocket') {
    return;
  }
  
  // Navigation requests: network first so every deploy reaches devices at
  // once; the saved app shell is only a fallback when the network fails.
  // (Cache-first here kept serving the first-ever index.html, and with it the
  // old JavaScript bundle, to returning phones indefinitely.)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse.ok) {
            const shellCopy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', shellCopy));
          }
          return networkResponse;
        })
        .catch(() =>
          caches.match(event.request)
            .then((cached) => cached || caches.match('/'))
            .then((cached) => cached || caches.match('/offline.html'))
            .then((cached) => cached || new Response('Offline', { status: 503 }))
        )
    );
    return;
  }
  
  // For static assets, try cache first
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Serve from cache, update in background
        event.waitUntil(
          fetch(event.request).then((networkResponse) => {
            if (networkResponse.ok) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse.clone());
              });
            }
          }).catch(() => {})
        );
        return cachedResponse;
      }
      
      // Not in cache, fetch from network
      return fetch(event.request).then((networkResponse) => {
        // Cache successful responses for static assets
        if (networkResponse.ok && isStaticAsset(event.request.url)) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Network failed, check if we have a fallback
        if (event.request.destination === 'image') {
          return new Response('', { status: 404 });
        }
        return caches.match('/offline.html').then((offlineResponse) => {
          return offlineResponse || new Response('Offline', { status: 503 });
        });
      });
    })
  );
});

// Check if URL is a static asset we should cache
function isStaticAsset(url) {
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.woff', '.woff2', '.ttf', '.eot', '.ico'];
  return staticExtensions.some((ext) => url.includes(ext));
}

// Listen for messages from clients
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
  
  if (event.data === 'getVersion') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

console.log('[SW] Service Worker loaded:', CACHE_NAME);
