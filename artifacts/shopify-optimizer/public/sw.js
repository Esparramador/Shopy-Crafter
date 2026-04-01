// Shopy Crafter Service Worker — v4
const STATIC_CACHE = 'shopybrain-static-v4';

const PRECACHE = [
  '/css/design-system.css',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/manifest.json',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(STATIC_CACHE).then(c => {
      return Promise.allSettled(PRECACHE.map(url => c.add(url)));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== STATIC_CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Never intercept API calls, cross-origin requests, or Capacitor calls
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/shopify/')) return;

  // HTML navigations: always network-first, never stale
  if (e.request.headers.get('accept')?.includes('text/html')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(`
          <!DOCTYPE html>
          <html lang="es">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Shopy Crafter — Sin conexión</title>
            <style>
              body { background: #080810; color: #fff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; flex-direction: column; gap: 16px; text-align: center; padding: 24px; }
              h1 { font-size: 24px; color: #c8a84b; }
              p { color: #888; font-size: 14px; }
              button { background: #c8a84b; color: #080810; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 14px; }
            </style>
          </head>
          <body>
            <div style="font-size:48px">⚡</div>
            <h1>Shopy Crafter</h1>
            <p>Sin conexión — Revisa tu internet e intenta de nuevo</p>
            <button onclick="window.location.reload()">Reintentar</button>
          </body>
          </html>
        `, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
      )
    );
    return;
  }

  // Pre-cached static: stale-while-revalidate
  if (PRECACHE.includes(url.pathname)) {
    e.respondWith(
      caches.open(STATIC_CACHE).then(async cache => {
        const cached = await cache.match(e.request);
        const networkFetch = fetch(e.request).then(res => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        }).catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  // Everything else: network-first, cache as fallback
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok && !url.pathname.includes('hot-update')) {
        caches.open(STATIC_CACHE).then(c => c.put(e.request, res.clone()));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});

// Push notifications
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'Shopy Crafter', {
      body: data.body || 'Nueva notificación',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url || '/admin/intelligence' },
      actions: data.actions || [],
      tag: data.tag || 'shopybrain',
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      const url = e.notification.data?.url || '/admin/intelligence';
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
