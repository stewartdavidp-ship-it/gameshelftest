/**
 * Word Boxing PWA Service Worker
 * Version: 1.0.21
 */
const CACHE_VERSION = 'v1.0.21';
const CACHE_NAME = `wordboxing-pwa-${CACHE_VERSION}`;

const CACHE_FILES = ['./', './index.html', './manifest.json'];

// Network timeout for HTML requests (ms)
const NETWORK_TIMEOUT = 2000;

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CACHE_FILES)));
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => Promise.all(
            cacheNames.map((cacheName) => {
                if (cacheName.startsWith('wordboxing-pwa-') && cacheName !== CACHE_NAME) {
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
    if (url.origin !== location.origin && !url.hostname.includes('fonts.googleapis.com') && !url.hostname.includes('firebaseio.com')) return;
    
    // Network-first with timeout for navigation requests (HTML)
    // This ensures users always get the latest version when online
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
                new Promise((resolve) => {
                    setTimeout(() => resolve(null), NETWORK_TIMEOUT);
                })
            ]).then((response) => {
                if (response) return response;
                // Network timed out or failed, try cache
                return caches.match(event.request).then((cached) => {
                    return cached || caches.match('./index.html');
                });
            }).catch(() => {
                return caches.match('./index.html');
            })
        );
        return;
    }
    
    // Stale-while-revalidate for other assets (images, fonts, etc.)
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                event.waitUntil(fetch(event.request).then((r) => {
                    if (r && r.status === 200) caches.open(CACHE_NAME).then((c) => c.put(event.request, r.clone()));
                }).catch(() => {}));
                return cachedResponse;
            }
            return fetch(event.request).then((response) => {
                if (response && response.status === 200 && !url.hostname.includes('firebaseio.com')) {
                    caches.open(CACHE_NAME).then((c) => c.put(event.request, response.clone()));
                }
                return response;
            }).catch(() => new Response('Offline', { status: 503 }));
        })
    );
});
