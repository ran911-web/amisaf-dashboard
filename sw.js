// Amisaf Dashboard Service Worker — v3 (network-first)
// Strategy: HTML always from network (falls back to cache only when offline).
// This prevents users from being stuck on stale versions.
const CACHE_NAME = 'amisaf-v30';
const STATIC_ASSETS = ['./icon-192.png', './icon-512.png', './manifest.json'];

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting(); // activate immediately, don't wait for old tabs
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim()) // take control of all open tabs now
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never touch API calls (Supabase, EmailJS, CDNs) — let them go straight through
  if (url.origin !== self.location.origin) return;

  // HTML / navigation: NETWORK FIRST — always try fresh, cache only as offline fallback
  if (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Static assets: cache first, then network
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }))
  );
});
