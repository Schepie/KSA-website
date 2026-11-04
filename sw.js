const CACHE_NAME = 'ksa-app-v2';
const STATIC_ASSETS = [
  './mobile.html',
  './manifest.json',
  './css/mobile.css',
  './js/mobile.js',
  './js/html2canvas.min.js',
  './assets/icons/pwa-icon-192.png',
  './assets/icons/pwa-icon-512.png',
  './assets/icons/pwa-icon-maskable.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/ksa-logo-official.svg'
];

// Install: pre-cache static essentials
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Niet alle statische bestanden konden direct worden gecachet:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean up older caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: Network first (altijd meest actuele website), cache fallback offline
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Sla externe API's / form endpoints over
  if (url.origin !== location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('./mobile.html');
          }
        });
      })
  );
});

