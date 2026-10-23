// Offline support: network first so updates show immediately, cache when offline.
// Bump VERSION whenever any of these files change so installed copies update.
const VERSION = 'geoflex-v8';
const SHELL = [
  './',
  'index.html',
  'css/app.css',
  'js/app.js',
  'js/shapes.js',
  'js/solvers.js',
  'js/units.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(VERSION).then(cache =>
      fetch(e.request)
        .then(res => { if (res.ok) cache.put(e.request, res.clone()); return res; })
        .catch(() => cache.match(e.request, { ignoreSearch: true }))),
  );
});
