const CACHE_NAME = 'dadris-pwa-v1';

// Install event - take over immediately
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

// Activate event - clean up old caches if needed
self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

// Fetch event - strictly pass all network requests through so live data never gets stuck
self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request));
});