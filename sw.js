// OneSignal Web Push SDK Integratie
try {
  importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
} catch (e) {
  console.warn('[SW] OneSignal import mislukt:', e);
}

const CACHE_NAME = 'ksa-app-v3';
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
        console.warn('[SW] Pre-cache gedeeltelijk gelukt:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: ruim oude caches direct op
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

// Luister naar expliciet update-commando vanuit de app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch: Netwerk-eerst (altijd meest actuele website), val terug op cache bij geen internet
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Inhoud van de website (data/site-content.json) en GitHub API's ALTIJD vers ophalen
  if (url.pathname.includes('site-content.json') || url.hostname.includes('github')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Sla externe diensten / mail forms over
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
