// sw.js — service worker del Sistema. Guarda los archivos para usar la app sin conexión.
// Al publicar una versión nueva, cambia CACHE para que los teléfonos tomen los archivos nuevos.
const CACHE = 'sistema-v0.1';
const ARCHIVOS = [
  './', './index.html', './config.js', './sistema-app.js', './manifest.json',
  './app/sistema.css', './modulos/equipos/equipos.css',
  './iconos/icono-192.png', './iconos/icono-512.png', './iconos/icono-512-maskable.png',
  './vendor/xlsx.full.min.js', './vendor/qrcode.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(claves => Promise.all(claves.filter(k => k.startsWith('sistema-') && k !== CACHE).map(k => caches.delete(k))))
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
