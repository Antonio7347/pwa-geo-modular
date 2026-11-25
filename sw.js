// ==========================================================================
// sw.js - Service Worker con estrategia Cache First y App Shell modular
// Tema 6.3: Soporte Offline de Interfaz y Módulo Reutilizable (geo-helper.js)
// Alumno: Antonio García González
// ==========================================================================
// REGLA DEL CURSO: 100% JavaScript Vanilla sin librerías externas y CERO async/await.
// Asincronía resuelta exclusivamente con Promesas (.then / .catch / Promise.all).
// ==========================================================================

const CACHE_NAME = 'pwa-geo-modular-v2';

// Todos los activos usan rutas relativas (./) para resolverse dentro del subdirectorio
// del repositorio en GitHub Pages sin errores 404. Es indispensable incluir ./geo-helper.js
// en el precaché para que la lógica modular y el Plan B sigan disponibles offline.
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

// 1. EVENTO INSTALL: Precarga atómica del App Shell completo
self.addEventListener('install', (event) => {
  self.skipWaiting();

  // Si cualquiera de los 8 archivos falla con 404, cache.addAll() rechaza y aborta la instalación
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Precacheando App Shell incluyendo ./geo-helper.js...');
        return cache.addAll(ARCHIVOS_APP_SHELL);
      })
  );
});

// 2. EVENTO ACTIVATE: Purga de contenedores obsoletos y reclamo inmediato de pestañas
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

// 3. EVENTO FETCH: Estrategia Cache First exclusiva para lecturas GET
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
