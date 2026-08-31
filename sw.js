const CACHE_NAME = 'fs-escala-local-v36';
const CORE_FILES = [
  './',
  './index.html',
  './FS_Escala_Operacional_Inteligente.html',
  './fs-runtime-guard.js',
  './fs-stability.css',
  './fs-continuity-v2.js',
  './fs-continuity-v2.css','./fs-mobile.css',
  './manifest.webmanifest',
  './LOGO%20ATUAL.png',
  './icone-192.png',
  './icone-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(CORE_FILES); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (key) {
          return key !== CACHE_NAME && key.indexOf('fs-escala-local-') === 0;
        }).map(function (key) { return caches.delete(key); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(function (response) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put('./index.html', copy); });
          return response;
        })
        .catch(function () { return caches.match('./index.html'); })
    );
    return;
  }

  event.respondWith(
    fetch(event.request).then(function (response) {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
      }
      return response;
    }).catch(function () {
      return caches.match(event.request);
    })
  );
});
