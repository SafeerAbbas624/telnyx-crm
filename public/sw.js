// No-op service worker to silence 404 requests during development
// Some extensions attempt to register /sw.js; this file prevents 404 noise.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

