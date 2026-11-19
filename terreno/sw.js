const CACHE = 'terreno-topo-v51-0.8.0';
const ASSETS = [
  './', './index.html', './js/01-config.js', './js/02-datos.js', './js/03-utilidades.js', './js/04-fotos-imagenes.js', './js/05-nube-y-calculos.js', './js/06-modales-y-navegacion.js', './js/07-jornada.js', './js/08-levantamiento.js', './js/09-catastro.js', './js/10-historial-y-reportes.js', './js/11-monografias-lista.js', './js/12-monografias-vista-previa.js', './js/13-monografias-importador.js', './js/14-monografias-editor.js', './js/15-pdf-y-excel.js', './js/16-sesiones.js', './js/17-respaldo.js', './js/18-normas.js', './js/19-planillas.js', './js/20-fotos-req.js', './js/21-panel-web.js', './js/pronostico-vuelo.js', './js/topoland-conexion.js', './js/22-sistema.js', './js/23-gastos.js', './js/24-simple.js', './css/pronostico-vuelo.css', './css/gastos.css', './js/99-inicio.js', './manifest.json', './icon-192.png', './icon-512.png',
  './vendor/jspdf.umd.min.js', './vendor/jspdf.plugin.autotable.min.js', './vendor/xlsx.full.min.js',
  './vendor/leaflet.js', './vendor/leaflet.css', './vendor/pdf.min.js', './vendor/pdf.worker.min.js',
  './vendor/images/layers.png', './vendor/images/layers-2x.png',
  './vendor/images/marker-icon.png', './vendor/images/marker-icon-2x.png', './vendor/images/marker-shadow.png'
];

// v0.6.0: los archivos de la app son obligatorios; ../config.js (Client ID del Sistema) se guarda si está disponible,
// para que la vinculación con el Sistema funcione también al abrir sin señal.
const OPCIONALES = ['../config.js'];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) =>
    cache.addAll(ASSETS).then(() => Promise.all(OPCIONALES.map((u) => cache.add(u).catch(() => {}))))
  ));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith('terreno-topo-') && k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  // Recursos externos (teselas de mapa, Google Drive) van directo a la red
  if (new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, clone));
        }
        return res;
      }).catch(() => {
        // Sin señal: cualquier navegación dentro de la app (p. ej. el enlace del QR) abre la app guardada.
        if (req.mode === 'navigate') return caches.match('./index.html');
        return new Response('', { status: 503, statusText: 'Sin conexión' });
      });
    })
  );
});
