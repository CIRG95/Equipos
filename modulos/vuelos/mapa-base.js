// modulos/vuelos/mapa-base.js — mapa base de Vuelos.
// · Esri satélite con nombres y caminos. Si config.js trae «esriClave» (cuenta gratuita de ArcGIS Location Platform),
//   se usa el servicio con clave, que permite uso comercial dentro del tramo gratuito; sin clave, el servidor público.
// · Sentinel-2 cloudless 2016 (EOX, licencia CC BY 4.0): libre, 10 m por píxel. Respaldo si Esri no carga.
// El usuario elige la capa en el control del mapa y queda recordada en este equipo.

const CLAVE_LS = 'vu_mapa_base';
const ESRI_PUBLICO = s => `https://server.arcgisonline.com/ArcGIS/rest/services/${s}/MapServer/tile/{z}/{y}/{x}`;

export const clave = () => (window.TOPOLAND_CONFIG && window.TOPOLAND_CONFIG.esriClave) || '';

/** Capas base disponibles: { nombre: L.Layer }. */
export function capasBase(L) {
  const k = clave();
  const op = { maxZoom: 20, maxNativeZoom: 19 };
  const esri = k
    ? L.layerGroup([
      L.tileLayer(`https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=${encodeURIComponent(k)}`, { ...op, attribution: 'Imagen © Esri, Maxar, Earthstar Geographics' }),
      L.tileLayer(`https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1/arcgis/imagery/labels/static/tile/{z}/{y}/{x}?token=${encodeURIComponent(k)}`, { ...op, tileSize: 512, zoomOffset: -1 }),
    ])
    : L.layerGroup([
      L.tileLayer(ESRI_PUBLICO('World_Imagery'), { ...op, attribution: 'Imagen © Esri, Maxar, Earthstar Geographics' }),
      L.tileLayer(ESRI_PUBLICO('Reference/World_Transportation'), op),
      L.tileLayer(ESRI_PUBLICO('Reference/World_Boundaries_and_Places'), op),
    ]);
  const sentinel = L.tileLayer('https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg', {
    maxZoom: 20, maxNativeZoom: 15,
    attribution: '<a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel-2 cloudless</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016)',
  });
  return { 'Satélite Esri': esri, 'Sentinel-2 2016 (libre, 10 m)': sentinel };
}

/** Agrega al mapa la capa base recordada (o Esri) y el selector de capas. */
export function agregarMapaBase(L, mapa) {
  const capas = capasBase(L);
  let elegida = 'Satélite Esri';
  try { const x = localStorage.getItem(CLAVE_LS); if (x && capas[x]) elegida = x; } catch { /* sin almacenamiento */ }
  capas[elegida].addTo(mapa);
  L.control.layers(capas, null, { position: 'topleft', collapsed: true }).addTo(mapa);
  mapa.on('baselayerchange', e => { try { localStorage.setItem(CLAVE_LS, e.name); } catch { /* */ } });
  return capas;
}
