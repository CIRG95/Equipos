// sw.js — service worker del Sistema. Guarda los archivos para usar la app sin conexión.
// Al publicar una versión nueva, cambia CACHE para que los teléfonos tomen los archivos nuevos.
// También borra la caché de la app de Equipos sola (equipos-…), porque el Sistema la reemplaza en el mismo repositorio.
const CACHE = 'sistema-v0.3';
const ARCHIVOS = [
  './', './index.html', './config.js', './sistema-app.js', './manifest.json',
  './app/sistema.css', './modulos/equipos/equipos.css', './modulos/vuelos/vuelos.css',
  './iconos/icono-192.png', './iconos/icono-512.png', './iconos/icono-512-maskable.png',
  './vendor/xlsx.full.min.js', './vendor/qrcode.js', './vendor/leaflet/leaflet.js', './vendor/leaflet/leaflet.css',
  './vendor/fuentes/fuentes.css', './vendor/fuentes/ibm-plex-sans-latin-400-normal.woff2', './vendor/fuentes/ibm-plex-sans-latin-500-normal.woff2',
  './vendor/fuentes/ibm-plex-sans-latin-600-normal.woff2', './vendor/fuentes/ibm-plex-sans-latin-700-normal.woff2',
  './vendor/fuentes/ibm-plex-mono-latin-400-normal.woff2', './vendor/fuentes/ibm-plex-mono-latin-500-normal.woff2',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(claves => Promise.all(claves.filter(k => (k.startsWith('sistema-') || k.startsWith('equipos-')) && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  // Red primero (para ver cambios al probar); si no hay conexión, lo guardado.
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
