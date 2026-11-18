// app_movil/sw.js - Service Worker para instalación PWA de Banca FC Taquilla App
const CACHE_NAME = 'banca-fc-app-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './app.css',
  './app_catalogs.js',
  './app_cloud.js',
  './app_main.js',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  // Nunca cachear peticiones en tiempo real a Firebase o APIs
  if (
    url.includes('firebaseio.com') ||
    url.includes('firebasedatabase.app') ||
    url.includes('/api/') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
