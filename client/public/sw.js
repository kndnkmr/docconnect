// ============================================
// ProMedicoz Service Worker
// ============================================
// Enables PWA functionality: offline support, caching.
//
// IMPORTANT caching strategy:
// - HTML / navigation  → NETWORK-FIRST  (always get the latest app after a deploy)
// - Hashed assets (JS/CSS/images) → CACHE-FIRST (they're versioned by filename, so safe)
// - API requests → NETWORK-FIRST (fresh data, cache only as offline fallback)
//
// Bumping CACHE_NAME on each meaningful change forces old caches to be cleared,
// so users pick up new versions without manually clearing their browser cache.

const CACHE_NAME = 'promedicoz-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install: pre-cache a minimal shell, then activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: delete any old caches, then take control of open pages
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Helper: is this a page navigation / HTML request?
function isHtmlRequest(request, url) {
  return (
    request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html')
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET
  if (request.method !== 'GET') return;

  // Only handle same-origin
  if (url.origin !== self.location.origin) return;

  // API requests: network-first, fall back to cache offline
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  // HTML / navigation: NETWORK-FIRST so a new deploy is always picked up.
  // Falls back to cached shell only when offline.
  if (isHtmlRequest(request, url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', clone));
          return response;
        })
        .catch(() => caches.match(request).then((c) => c || caches.match('/index.html')))
    );
    return;
  }

  // Hashed static assets (JS/CSS/images): cache-first (safe — filename changes per build)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
