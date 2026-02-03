/**
 * Quotle PWA Service Worker
 * Version: 1.2.9
 * 
 * ⚠️ IMPORTANT: CACHE_VERSION must match app version!
 */
const CACHE_VERSION = 'v1.2.9';
const CACHE_NAME = `quotle-pwa-${CACHE_VERSION}`;

const CACHE_FILES = ['./', './index.html', './manifest.json'];

// Network timeout for HTML requests (ms)
const NETWORK_TIMEOUT = 2000;

self.addEventListener('install', (event) => {
    console.log('[SW] Installing:', CACHE_VERSION);
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CACHE_FILES)));
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Activating:', CACHE_VERSION);
    event.waitUntil(
        caches.keys().then((cacheNames) => Promise.all(
            cacheNames.map((cacheName) => {
                if (cacheName.startsWith('quotle-pwa-') && cacheName !== CACHE_NAME) {
                    return caches.delete(cacheName);
                }
            })
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    if (url.origin !== location.origin && !url.hostname.includes('fonts.googleapis.com') && !url.hostname.includes('fonts.gstatic.com')) return;
    
    // Network-first with timeout for navigation requests (HTML)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            Promise.race([
                fetch(event.request).then((response) => {
                    if (response && response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
                    }
                    return response;
                }),
                new Promise((resolve) => setTimeout(() => resolve(null), NETWORK_TIMEOUT))
            ]).then((response) => {
                if (response) return response;
                return caches.match(event.request).then((cached) => cached || caches.match('./index.html'));
            }).catch(() => caches.match('./index.html'))
        );
        return;
    }
    
    // Stale-while-revalidate for other assets
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                event.waitUntil(fetch(event.request).then((r) => {
                    if (r && r.status === 200) caches.open(CACHE_NAME).then((c) => c.put(event.request, r.clone()));
                }).catch(() => {}));
                return cachedResponse;
            }
            return fetch(event.request).then((response) => {
                if (response && response.status === 200) {
                    caches.open(CACHE_NAME).then((c) => c.put(event.request, response.clone()));
                }
                return response;
            }).catch(() => new Response('Offline', { status: 503 }));
        })
    );
});

console.log('[SW] Loaded:', CACHE_VERSION);
