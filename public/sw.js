const CACHE_NAME = 'cptp-scoring-cache-v56';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/favicon.ico',
  '/flag-paraguay.svg',
  '/logo-cptp.svg',
  '/logo-long-range.svg'
];

// Instalar el Service Worker y precachear los recursos base
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-cacheando recursos base...');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activar el Service Worker y limpiar cachés viejas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Limpiando caché antigua:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptar peticiones para servir desde caché (offline) y actualizar en segundo plano
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Solo cacheamos peticiones GET de nuestro propio origen (mismo dominio)
  if (event.request.method === 'GET' && requestUrl.origin === self.location.origin) {
    
    // Si es una petición de navegación (abrir la página principal / o rutas)
    if (event.request.mode === 'navigate') {
      event.respondWith(
        fetch(event.request).then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put('/index.html', networkResponse.clone());
            return networkResponse;
          });
        }).catch(() => {
          return caches.match('/index.html');
        })
      );
      return;
    }

    // Para cualquier otro recurso estático (JS, CSS, imágenes, SVGs)
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Estrategia Stale-While-Revalidate: servir desde caché al instante,
          // pero descargar de red en segundo plano para actualizar la caché por si cambió
          fetch(event.request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
            }
          }).catch(() => {
            // Silenciar errores de red en segundo plano cuando está offline
          });
          return cachedResponse;
        }

        // Si no está en caché, ir a la red, cachear la respuesta y devolverla
        return fetch(event.request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        }).catch(() => {
          // Fallback offline para imágenes u otros recursos si fallan
          console.warn('[SW] Recurso no encontrado offline:', event.request.url);
        });
      })
    );
  }
});
