const CACHE_NAME = 'docvault-v2';
const urlsToCache = [
  '/',
  '/boveda',
  '/compartir'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// Manejar share target
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Interceptar POST a /compartir (share target)
  if (url.pathname === '/compartir' && event.request.method === 'POST') {
    event.respondWith(handleShare(event.request));
    return;
  }
  
  // Cache normal
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});

async function handleShare(request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('media');
    
    if (files && files.length > 0) {
      const file = files[0];
      // Guardar en cache temporal
      const cache = await caches.open('docvault-share');
      await cache.put('/shared-file', new Response(file));
    }
  } catch (e) {
    console.log('Error handling share:', e);
  }
  
  // Redirigir a la página de compartir
  return Response.redirect('/compartir', 303);
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== 'docvault-share') {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});
