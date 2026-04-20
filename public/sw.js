const CACHE_NAME = 'docvault-v2';
const STATIC_ASSETS = ['/icon-192.png', '/icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = event.request.url;
  // Network-first para HTML y navegación
  if (event.request.mode === 'navigate' || url.endsWith('/') || url.includes('/_next/')) {
    event.respondWith(
      fetch(event.request)
        .then(resp => {
          caches.open(CACHE_NAME).then(c => c.put(event.request, resp.clone()));
          return resp;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // Cache-first para assets estáticos
    event.respondWith(
      caches.match(event.request).then(r => r || fetch(event.request))
    );
  }
});
