// Service Worker pour PWA - Gard Eau Arbres
const CACHE_NAME = 'gea-sanctuaire-v1.0.0';
const RUNTIME_CACHE = 'gea-runtime-v1';

// Assets à mettre en cache au démarrage
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/data/plants.json',
  '/data/tour.json',
  '/assets/img/grain.png'
];

// Install - Cache les assets essentiels
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Precaching assets');
        return cache.addAll(PRECACHE_ASSETS.map(url => new Request(url, {cache: 'reload'})));
      })
      .catch(err => {
        console.warn('[SW] Precaching failed:', err);
      })
  );
  self.skipWaiting();
});

// Activate - Nettoie les anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE;
          })
          .map((cacheName) => {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    })
  );
  return self.clients.claim();
});

// Fetch - Stratégie Cache First avec fallback réseau
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes non-GET
  if (request.method !== 'GET') {
    return;
  }

  // Ignorer les requêtes cross-origin
  if (url.origin !== location.origin) {
    return;
  }

  // Stratégie pour les données JSON : Network First
  if (url.pathname.startsWith('/data/') || url.pathname.endsWith('.json')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
    return;
  }

  // Stratégie pour les images : Cache First
  if (url.pathname.startsWith('/assets/img/')) {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(request).then((response) => {
            if (response.ok) {
              const responseClone = response.clone();
              caches.open(RUNTIME_CACHE).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return response;
          });
        })
        .catch(() => {
          // Fallback image si échec
          return new Response(
            '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect fill="#0f1511" width="400" height="300"/><text x="50%" y="50%" text-anchor="middle" fill="#a7b7ac" font-size="16">Image non disponible</text></svg>',
            { headers: { 'Content-Type': 'image/svg+xml' } }
          );
        })
    );
    return;
  }

  // Stratégie pour les autres assets : Cache First
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request)
          .then((response) => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            const responseToCache = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
            return response;
          });
      })
      .catch(() => {
        // Fallback pour HTML
        if (request.headers.get('accept').includes('text/html')) {
          return caches.match('/index.html');
        }
      })
  );
});

