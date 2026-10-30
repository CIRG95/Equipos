// modulos/vuelos/capas.js — capas de zonas de referencia (aeródromos, zonas restringidas, áreas protegidas, caminos).
// Hay dos fuentes:
//  · las que vienen con la app, listadas en vendor/capas/indice.json (KMZ/KML al lado);
//  · las que carga el usuario desde el teléfono o el PC (quedan guardadas en el almacén vuelos_capas).
// Son referenciales: la información oficial está en AIP Chile (DGAC).

import { leerArchivo, leerCapa } from './kml.js';
import { guardarCapaUsuario, listarCapasUsuario, borrarCapaUsuario } from './datos.js';
import { distPoligonos, distPuntoPoligono, distPuntoSegmento } from './geom.js';

export const TIPOS_CAPA = {
  aerodromo: { nombre: 'Aeródromos', color: '#1D4ED8' },
  restringida: { nombre: 'Zonas restringidas o prohibidas', color: '#B42318' },
  protegida: { nombre: 'Áreas protegidas', color: '#3F7D3A' },
  referencia: { nombre: 'Referencia (caminos, otros)', color: '#8A8F96' },
};

let cache = null;

/** Todas las capas disponibles: [{ id, nombre, tipo, fecha, origen: 'app'|'usuario', elementos }]. */
export async function listarCapas() {
  if (cache) return cache;
  const deApp = [];
  try {
    const r = await fetch('vendor/capas/indice.json', { cache: 'no-cache' });
    if (r.ok) {
      const indice = await r.json();
      for (const c of indice.capas || []) {
        try {
          const blob = await (await fetch(`vendor/capas/${c.archivo}`)).blob();
          const elementos = await elementosDeArchivo(new File([blob], c.archivo));
          deApp.push({ id: `app:${c.archivo}`, nombre: c.nombre, tipo: c.tipo, fecha: c.fecha || '', fuente: c.fuente || '', origen: 'app', elementos });
        } catch (e) { console.warn('Capa no leída', c.archivo, e); }
      }
    }
  } catch { /* sin índice: solo las del usuario */ }
  const delUsuario = (await listarCapasUsuario()).map(c => ({ ...c, origen: 'usuario' }));
  cache = [...deApp, ...delUsuario];
  return cache;
}

/** GeoJSON (como los del visor de Vuelatudrone) → elementos { tipo, nombre, coords }. */
export function leerGeoJSON(json) {
  const out = [];
  const nombreDe = p => (p && (p.name || p.nombre || p.Name || p.NOMBRE)) || '';
  const agregar = (g, nombre) => {
    if (!g) return;
    if (g.type === 'Point') out.push({ tipo: 'punto', nombre, coords: g.coordinates.slice(0, 2) });
    else if (g.type === 'MultiPoint') g.coordinates.forEach(c => out.push({ tipo: 'punto', nombre, coords: c.slice(0, 2) }));
    else if (g.type === 'LineString') out.push({ tipo: 'linea', nombre, coords: g.coordinates.map(c => c.slice(0, 2)) });
    else if (g.type === 'MultiLineString') g.coordinates.forEach(l => out.push({ tipo: 'linea', nombre, coords: l.map(c => c.slice(0, 2)) }));
    else if (g.type === 'Polygon') out.push({ tipo: 'poligono', nombre, coords: g.coordinates[0].map(c => c.slice(0, 2)) });
    else if (g.type === 'MultiPolygon') g.coordinates.forEach(p => out.push({ tipo: 'poligono', nombre, coords: p[0].map(c => c.slice(0, 2)) }));
    else if (g.type === 'GeometryCollection') g.geometries.forEach(x => agregar(x, nombre));
  };
  for (const f of json.features || []) agregar(f.geometry, nombreDe(f.properties));
  return out;
}

async function elementosDeArchivo(archivo) {
  if (/\.(geo)?json$/i.test(archivo.name)) return leerGeoJSON(JSON.parse(await archivo.text()));
  return leerCapa(await leerArchivo(archivo));
}

export async function cargarCapaDesdeArchivo(archivo, tipo, nombre) {
  const elementos = await elementosDeArchivo(archivo);
  if (!elementos.length) throw new Error('El archivo no trae puntos, líneas ni polígonos.');
  await guardarCapaUsuario({ nombre: nombre || archivo.name.replace(/\.(kmz|kml|geojson|json)$/i, ''), tipo, fecha: new Date().toISOString().slice(0, 10), fuente: archivo.name, elementos });
  cache = null;
  return elementos.length;
}

export async function quitarCapa(id) { await borrarCapaUsuario(id); cache = null; }

/**
 * Revisa el área de vuelo contra las capas activas.
 * area: anillo [lon, lat]; marco: { aXY } del área. Devuelve [{ tipo, nombre, capa, distancia, toca }] ordenado.
 */
export function revisarZonas(area, marco, capas, activas) {
  const A = area.map(marco.aXY);
  const resultados = [];
  for (const c of capas) {
    if (!activas.includes(c.id) || c.tipo === 'referencia') continue;
    let mejor = null;
    for (const el of c.elementos) {
      // Descarte rápido: lo que está a más de ~60 km no se calcula.
      const ref = el.tipo === 'punto' ? el.coords : el.coords[0];
      const [x0, y0] = marco.aXY(ref);
      if (Math.hypot(x0, y0) > 60000 + 50000) continue;
      let d;
      if (el.tipo === 'punto') d = distPuntoPoligono(marco.aXY(el.coords), A);
      else if (el.tipo === 'poligono') d = distPoligonos(A, el.coords.map(marco.aXY));
      else { const L = el.coords.map(marco.aXY); d = Infinity; for (const p of A) for (let i = 0; i + 1 < L.length; i++) d = Math.min(d, distPuntoSegmento(p, L[i], L[i + 1])); }
      if (!mejor || d < mejor.distancia) mejor = { tipo: c.tipo, nombre: el.nombre || c.nombre, capa: c.nombre, distancia: d, toca: d === 0 };
    }
    if (mejor && mejor.distancia < 60000) resultados.push(mejor);
  }
  return resultados.sort((a, b) => a.distancia - b.distancia);
}
