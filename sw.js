/**
 * Game Shelf PWA Service Worker v1.3.17
 * 
 * ⚠️ IMPORTANT: CACHE_VERSION must match app version!
 * Update this on EVERY release to force PWA update.
 */

const CACHE_VERSION = 'v1.3.18';
const CACHE_NAME = `gameshelf-pwa-${CACHE_VERSION}`;

// Install - skip waiting immediately to activate new SW
self.addEventListener('install', (event) => {
  console.log('[SW] Installing:', CACHE_VERSION);
  self.skipWaiting(); // Don't wait for old SW to die
});

// Activate - claim clients and clear ALL old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating:', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then(names => {
      return Promise.all(
        names.map(name => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => {
      // Take control of all pages immediately
      return self.clients.claim();
    }).then(() => {
      // Notify all clients to refresh
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION });
        });
      });
    })
  );
});

// Fetch - Network first, fall back to cache for offline
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  // Skip non-http requests
  if (!event.request.url.startsWith('http')) return;
  
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clone and cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request).then(cached => {
          return cached || new Response('Offline - please reconnect', { 
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
          });
        });
      })
  );
});

// Listen for skip waiting message from page
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[SW] Loaded:', CACHE_VERSION);
