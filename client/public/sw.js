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

const CACHE_NAME = 'promedicoz-v7';
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

// ============================================
// Web Push - show a notification, even if the app isn't open
// ============================================
// The backend sends a JSON payload: { title, body, url, tag }
// (see server/utils/push.js). "tag" groups/replaces related notifications
// (e.g. repeated call pings for the same appointment collapse into one).
self.addEventListener('push', (event) => {
  let data = { title: 'ProMedicoz', body: 'You have a new update.', url: '/dashboard' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) { /* fall back to defaults above */ }

  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag,
    data: { url: data.url || '/dashboard', kind: data.kind || '', snoozeUrl: data.snoozeUrl || '', snoozeToken: data.snoozeToken || '' }
  };

  // Call alarm (appointment starting / incoming call / test alarm):
  // stays on screen until tapped, long vibration, alerts again on every
  // ring even with the same tag, and Join now / In 5 min buttons.
  // (The phone chooses the sound; Android uses the notification sound.)
  if (data.kind === 'call') {
    options.requireInteraction = true;
    options.renotify = !!data.tag;
    options.silent = false;
    options.vibrate = [800, 300, 800, 300, 800, 300, 800, 300, 800];
    options.actions = [{ action: 'join', title: 'Join now' }];
    if (data.snoozeUrl && data.snoozeToken) options.actions.push({ action: 'later', title: 'In 5 min' });
  }

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title, options),
      // Tell any open ProMedicoz tab, so it can ring in-page too.
      data.kind === 'call'
        ? self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) =>
            list.forEach((c) => c.postMessage({ type: 'pmz-call', appointmentId: data.appointmentId || '' })))
        : null,
    ])
  );
});

// Clicking the notification focuses an existing tab if one is open,
// otherwise opens a new one at the target URL. "In 5 min" asks the server
// to ring this person again in 5 minutes (signed token, no login needed).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const d = event.notification.data || {};
  const targetUrl = d.url || '/dashboard';

  if (event.action === 'later' && d.snoozeUrl && d.snoozeToken) {
    event.waitUntil(
      fetch(d.snoozeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: d.snoozeToken })
      }).catch(() => {})
    );
    return;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
      for (const client of clientsList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
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
