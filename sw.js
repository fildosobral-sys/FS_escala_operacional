const CACHE_NAME = 'fs-escala-central-v844';
const CORE_FILES = [
  './',
  './index.html',
  './FS_Escala_Operacional_Inteligente.html',
  './fs-runtime-guard.js',
  './fs-stability.css',
  './fs-continuity-v2.js',
  './fs-continuity-v2.css',
  './fs-cloud-v716.js',
  './fs-cloud-v716.css',
  './fs-dashboard-v800.js',
  './fs-dashboard-v800.css',
  './fs-central-v812.js',
  './fs-central-v812.css',
  './fs-ui-v806.js',
  './fs-ui-v806.css',
  './fs-equilibrio-v807.js',
  './fs-equilibrio-v807.css',
  './fs-refino-v808.js',
  './fs-refino-v808.css',
  './fs-fotos-relatorios-v809.js',
  './fs-fotos-relatorios-v809.css',
  './fs-final-v810.js',
  './fs-final-v810.css',
  './fs-consolidacao-v811.js',
  './fs-consolidacao-v811.css',
  './fs-42h.js',
  './fs-editor-v824.js',
  './fs-editor-v824.css',
  './fs-hotfix-v825.css',
  './fs-domingo-v831.js',
  './fs-domingo-v831.css',
  './fs-conformidade-v832.js',
  './fs-conformidade-v832.css',
  './fs-conformidade-v833.css',
  './fs-consolidado-v835.js',
  './fs-consolidado-v835.css',
  './fs-finalizacao-v837.js',
  './fs-finalizacao-v837.css',
  './fs-banco-horas-v842.js',
  './fs-banco-horas-v842.css',
  './fs-pdf-import-v717.js',
  './pdf.min.mjs',
  './pdf.worker.min.mjs',
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
          return key !== CACHE_NAME && key.indexOf('fs-escala-') === 0;
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

  if (/fs-(?:cloud-v716|dashboard-v800|central-v812|ui-v806|equilibrio-v807|refino-v808|fotos-relatorios-v809|final-v810|finalizacao-v837|banco-horas-v842|consolidacao-v811|editor-v824|domingo-v831|conformidade-v832|conformidade-v833|consolidado-v835)\.(?:js|css)$/.test(url.pathname) || /fs-42h\.js$/.test(url.pathname)) {
    event.respondWith(
      fetch(event.request).then(function (response) {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
        }
        return response;
      }).catch(function () { return caches.match(event.request); })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      return cached || fetch(event.request).then(function (response) {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
        }
        return response;
      });
    })
  );
});
