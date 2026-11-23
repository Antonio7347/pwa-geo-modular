// ==========================================================================
// sw.js - Service Worker con estrategia Cache First y App Shell modular
// Alumno: Antonio Garcia Gonzalez
// ==========================================================================
// REGLA TECNICA: 100% JavaScript Vanilla sin librerias externas.
// Asincronia construida y consumida exclusivamente con Promesas (.then / .catch).
// ==========================================================================

const CACHE_NAME = 'pwa-geo-modular-v1';

// Todos los activos usan rutas relativas (./) para funcionar correctamente
// dentro del subdirectorio de GitHub Pages, incluyendo ./geo-helper.js.
const ARCHIVOS_APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './geo-helper.js',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// 1. EVENTO INSTALL: Precarga en cache todos los archivos del App Shell
self.addEventListener('install', (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Precacheando App Shell incluyendo ./geo-helper.js...');
        return cache.addAll(ARCHIVOS_APP_SHELL);
      })
  );
});

// 2. EVENTO ACTIVATE: Limpia caches antiguas y toma control inmediato del cliente
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((nombresCaches) => {
        return Promise.all(
          nombresCaches.map((nombre) => {
            if (nombre !== CACHE_NAME) {
              console.log('[SW] Eliminando caché obsoleta:', nombre);
              return caches.delete(nombre);
            }
          })
        );
      })
      .then(() => {
        return self.clients.claim();
      })
  );
});

// 3. EVENTO FETCH: Estrategia Cache First con respaldo a red
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then((respuestaCache) => {
        if (respuestaCache) {
          return respuestaCache;
        }
        return fetch(event.request);
      })
  );
});
