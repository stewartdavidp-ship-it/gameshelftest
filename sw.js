/**
 * Game Shelf Service Worker v1.1.0
 * Handles: Caching, Push Notifications, Background Sync, Offline Support
 */

const CACHE_VERSION = 'v1.1.0';
const CACHE_NAME = `gameshelf-${CACHE_VERSION}`;

// Files to cache for offline use
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/gameshelf.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Cache strategies
const CACHE_STRATEGIES = {
  // Network first, fall back to cache
  networkFirst: ['api.', 'firebase'],
  // Cache first, fall back to network
  cacheFirst: ['.png', '.jpg', '.svg', '.woff', '.woff2'],
  // Stale while revalidate
  staleWhileRevalidate: ['.js', '.css', '.html']
};

// ============ INSTALL ============
self.addEventListener('install', (event) => {
  console.log('[SW] Installing version:', CACHE_VERSION);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Install complete');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Install failed:', error);
      })
  );
});

// ============ ACTIVATE ============
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating version:', CACHE_VERSION);
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('gameshelf-') && name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Claiming clients');
        return self.clients.claim();
      })
  );
});

// ============ FETCH ============
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) return;
  
  // Determine cache strategy
  let strategy = 'networkFirst';
  
  for (const [strat, patterns] of Object.entries(CACHE_STRATEGIES)) {
    if (patterns.some(pattern => url.href.includes(pattern))) {
      strategy = strat;
      break;
    }
  }
  
  switch (strategy) {
    case 'cacheFirst':
      event.respondWith(cacheFirst(event.request));
      break;
    case 'staleWhileRevalidate':
      event.respondWith(staleWhileRevalidate(event.request));
      break;
    case 'networkFirst':
    default:
      event.respondWith(networkFirst(event.request));
      break;
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);
  
  return cached || fetchPromise;
}

// ============ PUSH NOTIFICATIONS ============
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');
  
  let data = {
    title: 'Game Shelf',
    body: 'You have a notification',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    tag: 'default',
    data: { url: '/' }
  };
  
  try {
    if (event.data) {
      const payload = event.data.json();
      data = { ...data, ...payload };
    }
  } catch (e) {
    console.log('[SW] Push data parse error:', e);
  }
  
  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/badge-72.png',
    tag: data.tag || 'gameshelf',
    renotify: true,
    requireInteraction: data.requireInteraction || false,
    vibrate: [100, 50, 100],
    data: data.data || { url: '/' },
    actions: []
  };
  
  // Add context-specific actions
  switch (data.type) {
    case 'streak-reminder':
      options.actions = [
        { action: 'log', title: '📋 Log Game', icon: '/icons/action-log.png' },
        { action: 'snooze', title: '⏰ Later', icon: '/icons/action-snooze.png' }
      ];
      options.requireInteraction = true;
      break;
      
    case 'battle-update':
      options.actions = [
        { action: 'view-battle', title: '⚔️ View', icon: '/icons/action-battle.png' },
        { action: 'dismiss', title: 'Dismiss', icon: '/icons/action-dismiss.png' }
      ];
      break;
      
    case 'nudge':
      options.actions = [
        { action: 'log', title: '🎮 Play Now', icon: '/icons/action-play.png' },
        { action: 'dismiss', title: 'Later', icon: '/icons/action-dismiss.png' }
      ];
      options.requireInteraction = true;
      break;
      
    case 'friend-activity':
      options.actions = [
        { action: 'view-friends', title: '👥 See Friends', icon: '/icons/action-friends.png' }
      ];
      break;
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ============ NOTIFICATION CLICK ============
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  let url = event.notification.data?.url || '/';
  
  // Handle specific actions
  switch (event.action) {
    case 'log':
      url = '/?action=log';
      break;
    case 'view-battle':
      url = '/?tab=social&view=battles';
      break;
    case 'view-friends':
      url = '/?tab=social&view=friends';
      break;
    case 'snooze':
      // Could schedule another notification, for now just close
      return;
    case 'dismiss':
      return;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if open
        for (const client of clientList) {
          if (client.url.includes('gameshelf') && 'focus' in client) {
            client.postMessage({
              type: 'notification-click',
              action: event.action,
              data: event.notification.data
            });
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// ============ NOTIFICATION CLOSE ============
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed without action');
  // Could send analytics here
});

// ============ BACKGROUND SYNC ============
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-game-logs') {
    event.waitUntil(syncGameLogs());
  }
});

async function syncGameLogs() {
  // Get pending logs from IndexedDB and sync to server
  // This is a placeholder - implement based on your data structure
  console.log('[SW] Syncing game logs...');
}

// ============ PERIODIC BACKGROUND SYNC ============
self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync:', event.tag);
  
  if (event.tag === 'check-streaks') {
    event.waitUntil(checkStreaksInBackground());
  }
});

async function checkStreaksInBackground() {
  // Check if user has active streaks at risk
  // This would need server-side support
  console.log('[SW] Checking streaks in background...');
}

// ============ MESSAGE HANDLER ============
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  switch (event.data?.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_VERSION':
      event.ports[0].postMessage({ version: CACHE_VERSION });
      break;
      
    case 'CLEAR_CACHE':
      caches.delete(CACHE_NAME).then(() => {
        event.ports[0].postMessage({ cleared: true });
      });
      break;
  }
});

console.log('[SW] Service Worker loaded, version:', CACHE_VERSION);
