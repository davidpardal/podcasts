/* Caché simple para GitHub Pages: la app se abre sin red y los datos vivos siguen en localStorage.
 * No guarda calendarios, el proxy ni las APIs (Open-Meteo, REE). */
(function () {
  var CACHE = 'marco-v4-shell-v9';
  var ASSETS = [
    './',
    './index.html',
    './css/app.css',
    './js/config.js',
    './js/util.js',
    './js/custody.js',
    './js/calendar.js',
    './js/weather.js',
    './js/luz.js',
    './js/sync.js',
    './js/salud.js',
    './js/mochila.js',
    './js/casa.js',
    './js/outfit.js',
    './js/app.js',
    './img/outfit-demo.svg',
    './manifest.webmanifest',
    './icon.svg',
    './vendor/ical.min.js'
  ];

  self.addEventListener('install', function (event) {
    event.waitUntil(caches.open(CACHE).then(function (cache) { return cache.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
  });

  self.addEventListener('activate', function (event) {
    event.waitUntil(caches.keys().then(function (keys) {
      // Solo cachés marco-v4-shell-*. No borrar marco-v2-shell-*, marco-v3-shell-* ni las de /marco/.
      return Promise.all(keys.filter(function (k) { return k.indexOf('marco-v4-shell-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); }));
  });

  self.addEventListener('fetch', function (event) {
    var req = event.request;
    if (req.method !== 'GET') return;
    var url;
    try { url = new URL(req.url); } catch (e) { return; }
    if (url.origin !== self.location.origin) return;
    // Solo esta carpeta (p. ej. /podcasts/marco-v4/), nunca /marco/, marco-v2 ni marco-v3.
    var scopePath = new URL('./', self.location.href).pathname;
    if (url.pathname.indexOf(scopePath) !== 0) return;
    if (url.pathname.indexOf('/proxy') !== -1) return;
    event.respondWith(fetch(req).then(function (res) {
      if (res && res.ok && res.type === 'basic') {
        var copy = res.clone();
        caches.open(CACHE).then(function (cache) { cache.put(req, copy); }).catch(function () {});
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (cached) {
        if (cached) return cached;
        if (req.mode === 'navigate') return caches.match('./index.html').then(function (page) { return page || caches.match('./'); });
        return new Response('', { status: 504, statusText: 'offline' });
      });
    }));
  });
})();
