/**
 * Rungs PWA Service Worker
 * Version: 1.0.17
 */
const CACHE_VERSION = 'v1.0.17';
const CACHE_NAME = `rungs-pwa-${CACHE_VERSION}`;

const CACHE_FILES = ['./', './index.html', './manifest.json'];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CACHE_FILES)));
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => Promise.all(
            cacheNames.map((cacheName) => {
                if (cacheName.startsWith('rungs-pwa-') && cacheName !== CACHE_NAME) {
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
    if (url.origin !== location.origin && !url.hostname.includes('fonts.googleapis.com')) return;
    
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
            }).catch(() => event.request.mode === 'navigate' ? caches.match('./index.html') : new Response('Offline', { status: 503 }));
        })
    );
});
