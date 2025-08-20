/**
 * Service Worker for Music Analyzer Pro
 * Implements Cache First strategy with Network Fallback
 */

const CACHE_NAME = 'music-analyzer-v2.0.0';
const DYNAMIC_CACHE = 'music-analyzer-dynamic-v1';

// Files to cache on install
const STATIC_CACHE_URLS = [
    '/',
    '/index-with-search.html',
    '/src/index.js',
    '/config/app.config.js',
    '/js/error-tracker.js',
    '/js/logger.js',
    '/js/performance-monitor.js',
    '/js/performance-optimizer.js',
    '/js/database-optimizer.js',
    '/js/theme-controller.js',
    '/js/virtual-scroller.js',
    '/optimize-main.js',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png'
];

// Install event - cache static assets
self.addEventListener('install', event => {
    logDebug('[SW] Installing Service Worker');

    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then(cache => {
                logDebug('[SW] Caching static assets');
                return cache.addAll(STATIC_CACHE_URLS);
            })
            .then(() => self.skipWaiting())
            .catch(err => {
                logError('[SW] Failed to cache:', err);
            })
    );
});

// Activate event - clean old caches
self.addEventListener('activate', event => {
    logDebug('[SW] Activating Service Worker');

    event.waitUntil(
        caches
            .keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(name => name !== CACHE_NAME && name !== DYNAMIC_CACHE)
                        .map(name => {
                            logDebug('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip chrome-extension and other non-http(s) protocols
    if (!url.protocol.startsWith('http')) {
        return;
    }

    // Handle artwork images with Cache First strategy
    if (url.pathname.startsWith('/artwork-cache/')) {
        event.respondWith(
            caches.match(request).then(response => {
                if (response) {
                    return response;
                }

                return fetch(request).then(response => {
                    if (!response || response.status !== 200) {
                        return response;
                    }

                    const responseToCache = response.clone();
                    caches.open(DYNAMIC_CACHE).then(cache => {
                        cache.put(request, responseToCache);
                    });

                    return response;
                });
            })
        );
        return;
    }

    // Handle API/data requests with Network First strategy
    if (url.pathname.includes('/api/') || url.pathname.includes('.json')) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    const responseToCache = response.clone();
                    caches.open(DYNAMIC_CACHE).then(cache => {
                        cache.put(request, responseToCache);
                    });
                    return response;
                })
                .catch(() => {
                    return caches.match(request);
                })
        );
        return;
    }

    // Default strategy: Cache First with Network Fallback
    event.respondWith(
        caches
            .match(request)
            .then(response => {
                if (response) {
                    // Return cached version
                    return response;
                }

                // Fetch from network
                return fetch(request).then(response => {
                    // Check if valid response
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }

                    // Clone response for caching
                    const responseToCache = response.clone();

                    caches.open(DYNAMIC_CACHE).then(cache => {
                        cache.put(request, responseToCache);
                    });

                    return response;
                });
            })
            .catch(error => {
                logError('[SW] Fetch failed:', error);

                // Return offline page if available
                if (request.mode === 'navigate') {
                    return caches.match('/offline.html');
                }
            })
    );
});

// Handle background sync
self.addEventListener('sync', event => {
    logDebug('[SW] Background sync:', event.tag);

    if (event.tag === 'sync-tracks') {
        event.waitUntil(syncTracks());
    }
});

// Handle push notifications
self.addEventListener('push', event => {
    const options = {
        body: event.data ? event.data.text() : 'New update available',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-72.png',
        vibrate: [200, 100, 200],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        }
    };

    event.waitUntil(self.registration.showNotification('Music Analyzer Pro', options));
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
    event.notification.close();

    event.waitUntil(clients.openWindow('/'));
});

// Sync tracks function
async function syncTracks() {
    try {
        // Implement track syncing logic here
        logDebug('[SW] Syncing tracks...');
        return true;
    } catch (error) {
        logError('[SW] Sync failed:', error);
        return false;
    }
}

// Message handler for skip waiting
self.addEventListener('message', event => {
    if (event.data.action === 'skipWaiting') {
        self.skipWaiting();
    }
});
