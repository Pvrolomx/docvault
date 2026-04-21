const CACHE_NAME = 'docvault-v3';
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
  const req = event.request;
  const url = new URL(req.url);

  // BYPASS TOTAL: cross-origin (Supabase, APIs externas) y métodos no-GET
  // Esto evita que el SW rompa POSTs/PATCHes a Supabase
  if (url.origin !== self.location.origin || req.method !== 'GET') {
    return; // deja que el navegador maneje el fetch normal
  }

  // Network-first para HTML y navegación (con clone ANTES del return)
  if (req.mode === 'navigate' || url.pathname === '/' || url.pathname.startsWith('/_next/')) {
    event.respondWith(
      fetch(req)
        .then(resp => {
          const respClone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, respClone));
          return resp;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Cache-first para assets estáticos
  event.respondWith(
    caches.match(req).then(r => r || fetch(req))
  );
});
