// modulos/vuelos/redvial.js — Red vial (Dirección de Vialidad MOP, gdb 31-oct-2026) y despegue sugerido sobre un camino.
//
// · vendor/capas/redvial/indice.json lista un archivo por región con su recuadro; se baja solo la región que toca el área
//   (y queda guardada por el service worker para usarla sin señal).
// · El usuario puede agregar sus propios caminos a la hoja (dibujados o desde un KML): h.area.caminos = [{ nombre, linea }].
// · despegueSobreCamino() prueba puntos de los caminos cercanos al sector y se queda con el de menos minutos de jornada.
//   Es solo una referencia: no ve rejas, pendientes, propiedad privada ni la línea de vista.

import { calcularSector } from './hoja.js';
import { distPuntoPoligono, puntoEnPoligono, distPuntoSegmento } from './geom.js';

export const ATRIBUCION = 'Red vial: Dirección de Vialidad MOP, 31-oct-2026';
let indice = null;
const regiones = new Map(); // archivo → Promise<caminos>

async function cargarIndice() {
  if (indice) return indice;
  const r = await fetch('vendor/capas/redvial/indice.json');
  if (!r.ok) throw new Error('No se encontró la red vial (vendor/capas/redvial).');
  indice = await r.json();
  return indice;
}

function cargarRegion(archivo) {
  if (!regiones.has(archivo)) {
    regiones.set(archivo, fetch(`vendor/capas/redvial/${archivo}`).then(r => { if (!r.ok) throw new Error('sin archivo'); return r.json(); })
      .then(j => j.caminos.map(([rol, nombre, clasificacion, carpeta, linea]) => ({ rol, nombre, clasificacion, carpeta, linea, bbox: bboxDe(linea), origen: 'mop' })))
      .catch(e => { regiones.delete(archivo); throw e; }));
  }
  return regiones.get(archivo);
}

const bboxDe = linea => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const [x, y] of linea) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; } return [a, b, c, d]; };
const tocaBbox = (b, bb) => !(b[0] > bb[2] || b[2] < bb[0] || b[1] > bb[3] || b[3] < bb[1]);

/**
 * v0.11.1 · Recorta una línea [lon, lat] al recuadro (deja los tramos que entran, con un vértice de más a cada lado)
 * y la simplifica (tolerancia en grados; 0,00003° ≈ 3 m). Devuelve una lista de líneas.
 */
export function recortarLinea(linea, bb, tol = 0.00003) {
  const dentro = ([x, y]) => x >= bb[0] && x <= bb[2] && y >= bb[1] && y <= bb[3];
  const out = [];
  let actual = null;
  for (let k = 0; k < linea.length; k++) {
    const p = linea[k], cerca = dentro(p) || (k > 0 && dentro(linea[k - 1])) || (k + 1 < linea.length && dentro(linea[k + 1]));
    if (cerca) { if (!actual) actual = []; actual.push(p); } else if (actual) { out.push(actual); actual = null; }
  }
  if (actual) out.push(actual);
  return out.filter(l => l.length >= 2).map(l => simplificarLL(l, tol));
}

/** Douglas-Peucker en grados (suficiente para dibujar y buscar despegue). */
export function simplificarLL(l, tol) {
  if (l.length < 3 || !(tol > 0)) return l;
  const marca = new Uint8Array(l.length); marca[0] = marca[l.length - 1] = 1;
  const pila = [[0, l.length - 1]];
  while (pila.length) {
    const [a, b] = pila.pop();
    const [ax, ay] = l[a], [bx, by] = l[b], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    let max = -1, idx = -1;
    for (let k = a + 1; k < b; k++) {
      const [px, py] = l[k];
      const t = L2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2)) : 0;
      const d = Math.hypot(px - ax - t * dx, py - ay - t * dy);
      if (d > max) { max = d; idx = k; }
    }
    if (max > tol) { marca[idx] = 1; pila.push([a, idx], [idx, b]); }
  }
  return l.filter((_, k) => marca[k]).map(([x, y]) => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6]);
}

let ultimo = null; // { clave, caminos }: el mapa y la búsqueda de despegue piden el mismo recuadro
/** Caminos del MOP que tocan el recuadro [minLon, minLat, maxLon, maxLat], recortados a él y simplificados. */
export async function caminosEn(bbox) {
  const clave = bbox.map(x => x.toFixed(3)).join(',');
  if (ultimo && ultimo.clave === clave) return ultimo.caminos;
  const ind = await cargarIndice();
  const tocan = ind.regiones.filter(r => tocaBbox(r.bbox, bbox));
  const listas = await Promise.all(tocan.map(r => cargarRegion(r.archivo)));
  const caminos = [];
  for (const c of listas.flat()) {
    if (!tocaBbox(c.bbox, bbox)) continue;
    for (const linea of recortarLinea(c.linea, bbox)) caminos.push({ ...c, linea, bbox: bboxDe(linea) });
  }
  ultimo = { clave, caminos };
  return caminos;
}

/** Recuadro de una lista de [lon, lat] agrandado en km. */
export function recuadro(puntos, km = 2) {
  const xs = puntos.map(p => p[0]), ys = puntos.map(p => p[1]);
  const lat = (Math.min(...ys) + Math.max(...ys)) / 2;
  const dy = km / 111.32, dx = km / (111.32 * Math.cos(lat * Math.PI / 180));
  return [Math.min(...xs) - dx, Math.min(...ys) - dy, Math.max(...xs) + dx, Math.max(...ys) + dy];
}

/** Caminos propios de la hoja con el mismo formato que los del MOP. */
export function caminosDeHoja(hoja) {
  return (hoja.area.caminos || []).map(c => ({ rol: '', nombre: c.nombre || 'Camino agregado', clasificacion: 'Agregado en la hoja', carpeta: '', linea: c.linea, origen: 'hoja' }));
}

export const COLOR_CARPETA = c => /doble/i.test(c) ? '#F5F5F5' : /pavimento/i.test(c) ? '#E0E0E0' : /ripio|grava/i.test(c) ? '#E8C27A' : /suelo/i.test(c) ? '#C9A26B' : '#BDBDBD';
export const describirCamino = c => [c.rol, c.nombre, c.carpeta].filter(Boolean).join(' · ');

/**
 * Despegue sugerido para el sector i: el punto de los caminos (a lo más radio m del sector) con menos minutos de jornada.
 * caminos: [{ linea: [[lon, lat]…], … }]. Devuelve null si no hay caminos cerca, o
 * { lonLat, xy, minTotal, minActual, ahorro, camino, distSector, probados }.
 */
export function despegueSobreCamino(hoja, d, geo, i, caminos, { radio = 1500 } = {}) {
  const sec = geo.sectores[i];
  if (!sec) return null;
  const actual = calcularSector(hoja, d, geo, i);
  if (!actual) return null;
  const extra = { velocidad: actual.velocidad, ...(actual.rumbo != null && !actual.corredor ? { rumbo: actual.rumbo } : {}) };
  const poli = sec.poligono;
  const lejos = p => (puntoEnPoligono(p, poli) ? 0 : distPuntoPoligono(p, poli));
  // v0.11.1: solo los caminos cuyo recuadro está a menos de «radio» del sector, pasados a metros una sola vez.
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of poli) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  x0 -= radio; y0 -= radio; x1 += radio; y1 += radio;
  const cerca = [];
  caminos.forEach((c, ci) => {
    const xy = c.linea.map(geo.marco.aXY);
    let a = Infinity, b = Infinity, c2 = -Infinity, d2 = -Infinity;
    for (const [x, y] of xy) { if (x < a) a = x; if (y < b) b = y; if (x > c2) c2 = x; if (y > d2) d2 = y; }
    if (!(a > x1 || c2 < x0 || b > y1 || d2 < y0)) cerca.push({ ci, xy }); // recuadro de la línea (un tramo largo puede cruzar sin vértices cerca)
  });
  if (!cerca.length) return null;
  // Puntos cada ~paso m sobre los caminos cercanos (opcional: solo cerca de un punto).
  const muestras = (paso, centro = null, rCentro = 0) => {
    const out = [];
    for (const { ci, xy } of cerca) {
      for (let k = 0; k + 1 < xy.length; k++) {
        const a = xy[k], b = xy[k + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (centro && distPuntoSegmento(centro, a, b) > rCentro) continue;
        const n = Math.max(1, Math.ceil(l / paso));
        for (let j = 0; j < n; j++) {
          const p = [a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n];
          if (p[0] < x0 || p[0] > x1 || p[1] < y0 || p[1] > y1) continue;
          if (centro && Math.hypot(p[0] - centro[0], p[1] - centro[1]) > rCentro) continue;
          const dd = lejos(p);
          if (dd <= radio) out.push({ p, ci, dd });
        }
      }
    }
    return out;
  };
  let cand = muestras(100);
  if (!cand.length) return null;
  if (cand.length > 300) { const k = Math.ceil(cand.length / 300); cand = cand.filter((_, j) => j % k === 0); }
  const evaluar = c => { const r = calcularSector(hoja, d, geo, i, { ...extra, despegue: c.p }); return r ? r.minTotal : Infinity; };
  let mejor = null;
  for (const c of cand) { const t = evaluar(c); if (!mejor || t < mejor.t - 1e-6 || (Math.abs(t - mejor.t) < 1e-6 && c.dd < mejor.c.dd)) mejor = { c, t }; }
  // Afinar alrededor del mejor, cada 15 m en un radio de 150 m (a lo más 60 pruebas).
  let fino = muestras(15, mejor.c.p, 150);
  if (fino.length > 60) { const k = Math.ceil(fino.length / 60); fino = fino.filter((_, j) => j % k === 0); }
  for (const c of fino) {
    const t = evaluar(c);
    if (t < mejor.t - 1e-6) mejor = { c, t };
  }
  const camino = caminos[mejor.c.ci];
  return {
    xy: mejor.c.p, lonLat: geo.marco.aLonLat(mejor.c.p), minTotal: mejor.t, minActual: actual.minTotal,
    ahorro: actual.minTotal - mejor.t, camino, distSector: mejor.c.dd, probados: cand.length,
  };
}
