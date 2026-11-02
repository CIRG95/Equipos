// modulos/vuelos/redvial.js — Red vial (Dirección de Vialidad MOP, gdb 31-oct-2026) y despegue sugerido sobre un camino.
//
// · vendor/capas/redvial/indice.json lista un archivo por región con su recuadro; se baja solo la región que toca el área
//   (y queda guardada por el service worker para usarla sin señal).
// · El usuario puede agregar sus propios caminos a la hoja (dibujados o desde un KML): h.area.caminos = [{ nombre, linea }].
// · despegueSobreCamino() prueba puntos de los caminos cercanos al sector y se queda con el de menos minutos de jornada.
//   Es solo una referencia: no ve rejas, pendientes, propiedad privada ni la línea de vista.

import { calcularSector } from './hoja.js';
import { distPuntoPoligono, puntoEnPoligono } from './geom.js';

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
      .then(j => j.caminos.map(([rol, nombre, clasificacion, carpeta, linea]) => ({ rol, nombre, clasificacion, carpeta, linea, origen: 'mop' })))
      .catch(e => { regiones.delete(archivo); throw e; }));
  }
  return regiones.get(archivo);
}

/** Caminos del MOP que tocan el recuadro [minLon, minLat, maxLon, maxLat] (carga las regiones necesarias). */
export async function caminosEn(bbox) {
  const ind = await cargarIndice();
  const tocan = ind.regiones.filter(r => !(r.bbox[0] > bbox[2] || r.bbox[2] < bbox[0] || r.bbox[1] > bbox[3] || r.bbox[3] < bbox[1]));
  const listas = await Promise.all(tocan.map(r => cargarRegion(r.archivo)));
  const dentro = c => c.linea.some(([x, y]) => x >= bbox[0] && x <= bbox[2] && y >= bbox[1] && y <= bbox[3]);
  return listas.flat().filter(dentro);
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
  // Puntos cada ~paso m sobre los caminos, solo los que están cerca del sector.
  const muestras = (paso) => {
    const out = [];
    caminos.forEach((c, ci) => {
      const xy = c.linea.map(geo.marco.aXY);
      for (let k = 0; k + 1 < xy.length; k++) {
        const a = xy[k], b = xy[k + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const n = Math.max(1, Math.ceil(l / paso));
        for (let j = 0; j < n; j++) {
          const p = [a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n];
          const dd = lejos(p);
          if (dd <= radio) out.push({ p, ci, dd });
        }
      }
    });
    return out;
  };
  let cand = muestras(100);
  if (!cand.length) return null;
  if (cand.length > 300) { const k = Math.ceil(cand.length / 300); cand = cand.filter((_, j) => j % k === 0); }
  const evaluar = c => { const r = calcularSector(hoja, d, geo, i, { ...extra, despegue: c.p }); return r ? r.minTotal : Infinity; };
  let mejor = null;
  for (const c of cand) { const t = evaluar(c); if (!mejor || t < mejor.t - 1e-6 || (Math.abs(t - mejor.t) < 1e-6 && c.dd < mejor.c.dd)) mejor = { c, t }; }
  // Afinar alrededor del mejor, cada 15 m en un radio de 150 m.
  for (const c of muestras(15)) {
    if (Math.hypot(c.p[0] - mejor.c.p[0], c.p[1] - mejor.c.p[1]) > 150) continue;
    const t = evaluar(c);
    if (t < mejor.t - 1e-6) mejor = { c, t };
  }
  const camino = caminos[mejor.c.ci];
  return {
    xy: mejor.c.p, lonLat: geo.marco.aLonLat(mejor.c.p), minTotal: mejor.t, minActual: actual.minTotal,
    ahorro: actual.minTotal - mejor.t, camino, distSector: mejor.c.dd, probados: cand.length,
  };
}
