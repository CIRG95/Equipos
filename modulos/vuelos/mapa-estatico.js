// modulos/vuelos/mapa-estatico.js — fondo fijo (sin mover ni hacer zoom) de imagen híbrida para esquemas (v0.11.3).
// Arma las teselas de Esri (imagen + caminos + nombres) que cubren el recuadro, en coordenadas de Web Mercator,
// y entrega una función para dibujar encima en el mismo sistema (porcentajes del ancho y alto).
import { clave } from './mapa-base.js';

const TES = 256;
const ESRI = s => `https://server.arcgisonline.com/ArcGIS/rest/services/${s}/MapServer/tile`;
const px = (lon, lat, z) => {
  const n = TES * 2 ** z, s = Math.sin(lat * Math.PI / 180);
  return [(lon + 180) / 360 * n, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n];
};

/**
 * puntosLL: [[lon, lat]…] que deben quedar a la vista. W, H: tamaño lógico del esquema (px).
 * → { html: capas de teselas (posición en %), xy: ([lon, lat]) → [x, y] en 0..W / 0..H, z }
 */
export function fondoEstatico(puntosLL, W, H, { margen = 16, capas = 'hibrido' } = {}) {
  const lons = puntosLL.map(p => p[0]), lats = puntosLL.map(p => p[1]);
  const b = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
  let z = 18;
  for (; z > 2; z--) {
    const [x0, y1] = px(b[0], b[1], z), [x1, y0] = px(b[2], b[3], z);
    if (x1 - x0 <= W - 2 * margen && y1 - y0 <= H - 2 * margen) break;
  }
  const [cx0, cy1] = px(b[0], b[1], z), [cx1, cy0] = px(b[2], b[3], z);
  const ox = (cx0 + cx1) / 2 - W / 2, oy = (cy0 + cy1) / 2 - H / 2;
  const xy = ([lon, lat]) => { const [x, y] = px(lon, lat, z); return [x - ox, y - oy]; };
  const k = clave();
  const urls = [k ? `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=${encodeURIComponent(k)}` : `${ESRI('World_Imagery')}/{z}/{y}/{x}`];
  if (capas === 'hibrido') urls.push(`${ESRI('Reference/World_Transportation')}/{z}/{y}/{x}`, `${ESRI('Reference/World_Boundaries_and_Places')}/{z}/{y}/{x}`);
  const tx0 = Math.floor(ox / TES), tx1 = Math.floor((ox + W) / TES), ty0 = Math.floor(oy / TES), ty1 = Math.floor((oy + H) / TES);
  const max = 2 ** z;
  let html = '';
  for (const u of urls) for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    if (ty < 0 || ty >= max) continue;
    const x = ((tx % max) + max) % max;
    const src = u.replace('{z}', z).replace('{y}', ty).replace('{x}', x);
    html += `<img src="${src}" alt="" loading="lazy" draggable="false" onerror="this.remove()" style="left:${((tx * TES - ox) / W * 100).toFixed(4)}%;top:${((ty * TES - oy) / H * 100).toFixed(4)}%;width:${(TES / W * 100).toFixed(4)}%;height:${(TES / H * 100).toFixed(4)}%">`;
  }
  return { html, xy, z };
}
