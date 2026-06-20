// Shopy Crafter Service Worker — v7
// CRITICAL: HTML is NEVER cached. Only assets with content-hash get cached.
// This prevents stale index.html from breaking deploys when bundle hash changes.
const STATIC_CACHE  = 'sc-static-v7';
const FONT_CACHE    = 'sc-fonts-v7';
const IMAGE_CACHE   = 'sc-images-v7';

const PRECACHE = [
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/manifest.json',
  '/favicon.png',
];

const ALL_CACHES = [STATIC_CACHE, FONT_CACHE, IMAGE_CACHE];

// ── Install: precache critical statics ─────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(STATIC_CACHE)
      .then(c => Promise.allSettled(PRECACHE.map(url => c.add(url))))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: purge ALL old caches (v6 and below) ──────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !ALL_CACHES.includes(k)).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: multi-strategy routing ──────────────────────────────────────────
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // 1. Skip: API, Shopify proxy, hot-reload, dev tools
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/shopify/')) return;
  if (url.pathname.includes('hot-update')) return;
  if (url.pathname.includes('@vite') || url.pathname.includes('@react-refresh')) return;

  // 2. Google Fonts: cache-first (fonts never change)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(cacheFirst(e.request, FONT_CACHE));
    return;
  }

  // 3. Cross-origin — network only
  if (url.origin !== self.location.origin) return;

  // 4. HTML navigations: ALWAYS network-only, NEVER cache
  //    Caching index.html breaks deploys — Vite changes bundle hash each build.
  if (e.request.headers.get('accept')?.includes('text/html')) {
    e.respondWith(networkOnlyWithOfflineFallback(e.request));
    return;
  }

  // 5. Images: stale-while-revalidate
  if (/\.(png|jpe?g|webp|avif|gif|svg|ico)$/i.test(url.pathname)) {
    e.respondWith(staleWhileRevalidate(e.request, IMAGE_CACHE));
    return;
  }

  // 6. Hashed JS/CSS bundles (content-hash in filename): cache-forever
  //    Safe to cache permanently — Vite adds unique hash per build.
  if (/\/assets\/[^/]+-[A-Za-z0-9_-]+\.(js|css)(\?.*)?$/.test(url.pathname)) {
    e.respondWith(cacheFirst(e.request, STATIC_CACHE));
    return;
  }

  // 7. Everything else: pass through to network
  return;
});

// ── Strategies ─────────────────────────────────────────────────────────────
async function cacheFirst(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache      = await caches.open(cacheName);
  const cached     = await cache.match(request);
  const networkReq = fetch(request).then(res => {
    if (res.ok) cache.put(request, res.clone());
    return res;
  }).catch(() => cached);
  return cached || networkReq;
}

// HTML: always network, offline page only on true network failure
async function networkOnlyWithOfflineFallback(request) {
  try {
    return await fetch(request);
  } catch {
    return new Response(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Shopy Crafter — Sin conexión</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0 }
    body { background: #080810; color: #fff; font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100dvh; flex-direction: column; gap: 16px; text-align: center; padding: 24px }
    .icon { font-size: 52px; line-height: 1 }
    h1 { font-size: 22px; font-weight: 700; color: #c8a84b; margin-top: 8px }
    p { color: rgba(255,255,255,.5); font-size: 14px; max-width: 280px; line-height: 1.5 }
    button { background: #c8a84b; color: #080810; border: none; padding: 12px 28px; border-radius: 10px; font-weight: 700; cursor: pointer; font-size: 14px; margin-top: 8px }
    button:active { opacity: .85 }
  </style>
</head>
<body>
  <div class="icon">⚡</div>
  <h1>Shopy Crafter</h1>
  <p>Sin conexión — Revisa tu conexión a internet e inténtalo de nuevo.</p>
  <button onclick="window.location.reload()">Reintentar</button>
</body>
</html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}

// ── Push notifications ─────────────────────────────────────────────────────
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'Shopy Crafter', {
      body:    data.body    || 'Nueva notificación',
      icon:    '/icons/icon-192.png',
      badge:   '/icons/icon-192.png',
      data:    { url: data.url || '/' },
      actions: data.actions || [],
      tag:     data.tag     || 'sc-push',
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const url = e.notification.data?.url || '/';
      for (const client of list) {
        if ('focus' in client) { client.navigate(url); return client.focus(); }
      }
      return clients.openWindow(url);
    })
  );
});
