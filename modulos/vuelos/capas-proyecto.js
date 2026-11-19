// modulos/vuelos/capas-proyecto.js — capas del proyecto (Sistema v0.17): caminos y PR existentes desde KMZ/KML.
// Se cargan una vez en el proyecto y las usan Vuelos (bases de amarre, despegue sobre caminos) y Planificación.
// En el KMZ: las líneas son caminos y los puntos son PR ya instalados (con su nombre). Los puntos sin nombre útil
// («Marcador sin título») se guardan desactivados para que el encargado decida si son PR.
//
// v0.18: los polígonos son el área de trabajo del proyecto (un solo KMZ para todo: red de PR, marcas y vuelos).
// Se guardan en el registro del proyecto (compartido_proyectos), sin almacenes nuevos:
//   p.capas = { archivos: [nombre], areas: [{ id, nombre, anillo: [[lon, lat]…], ha }], caminos: [{ nombre, linea: [[lon, lat]…] }], prs: [{ id, nombre, lon, lat, usar }], actualizadoEn }

import { leerArchivo, leerCapa, limpiarAnillo } from './kml.js';
import { simplificarLL } from './redvial.js';
import { esNombreGenerico } from './amarre.js';

const TOL_LL = 0.00003; // ≈ 3 m: los caminos se simplifican para que el proyecto no pese de más al sincronizar
const r6 = x => Math.round(x * 1e6) / 1e6;

/** Superficie de un anillo [[lon, lat]…] en hectáreas (proyección local; sobra para planificar). */
export function haDeAnillo(anillo) {
  if (!anillo || anillo.length < 3) return 0;
  const lat0 = anillo.reduce((s, p) => s + p[1], 0) / anillo.length;
  const kx = Math.cos(lat0 * Math.PI / 180) * 111320, ky = 110540;
  let a = 0;
  for (let i = 0; i < anillo.length; i++) { const [x1, y1] = anillo[i], [x2, y2] = anillo[(i + 1) % anillo.length]; a += x1 * kx * y2 * ky - x2 * kx * y1 * ky; }
  return Math.round(Math.abs(a) / 2 / 1000) / 10;
}

/** Lee uno o más KMZ/KML y devuelve { areas, caminos, prs, poligonos, archivos }. */
export async function leerCapasDeArchivos(archivos) {
  const out = { areas: [], caminos: [], prs: [], poligonos: 0, archivos: [] };
  for (const f of [...archivos]) {
    const elementos = leerCapa(await leerArchivo(f));
    out.archivos.push(f.name);
    for (const e of elementos) {
      if (e.tipo === 'linea') out.caminos.push({ nombre: e.nombre || '', linea: simplificarLL(e.coords, TOL_LL).map(([x, y]) => [r6(x), r6(y)]) });
      else if (e.tipo === 'punto') out.prs.push({ nombre: (e.nombre || '').trim(), lon: r6(e.coords[0]), lat: r6(e.coords[1]) });
      else if (e.tipo === 'poligono') {
        const anillo = limpiarAnillo(e.coords).map(([x, y]) => [r6(x), r6(y)]);
        if (anillo.length >= 3) { out.areas.push({ nombre: (e.nombre || '').trim() || `Área ${out.areas.length + 1}`, anillo, ha: haDeAnillo(anillo) }); out.poligonos++; }
      }
    }
  }
  return out;
}

const clavePR = p => `${p.nombre.toLowerCase()}|${p.lon.toFixed(5)}|${p.lat.toFixed(5)}`;

/** Suma lo leído a las capas existentes del proyecto (sin repetir PR ni caminos). */
export function fusionarCapas(previas, nuevas, ahora = new Date().toISOString()) {
  const c = { archivos: [], areas: [], caminos: [], prs: [], ...(previas || {}) };
  const yaPR = new Set(c.prs.map(clavePR));
  const prs = [...c.prs];
  let n = prs.length;
  for (const p of nuevas.prs) {
    if (yaPR.has(clavePR(p))) continue;
    yaPR.add(clavePR(p));
    prs.push({ id: `pr${Date.now().toString(36)}${++n}`, nombre: p.nombre || `Punto ${n}`, lon: p.lon, lat: p.lat, usar: !esNombreGenerico(p.nombre) });
  }
  const yaCam = new Set(c.caminos.map(x => JSON.stringify(x.linea[0]) + JSON.stringify(x.linea[x.linea.length - 1])));
  const caminos = [...c.caminos, ...nuevas.caminos.filter(x => !yaCam.has(JSON.stringify(x.linea[0]) + JSON.stringify(x.linea[x.linea.length - 1])))];
  const claveArea = a => JSON.stringify(a.anillo[0]) + a.anillo.length;
  const yaArea = new Set((c.areas || []).map(claveArea));
  let na = (c.areas || []).length;
  const areas = [...(c.areas || []), ...(nuevas.areas || []).filter(a => !yaArea.has(claveArea(a))).map(a => ({ id: `ar${Date.now().toString(36)}${++na}`, ...a }))];
  return { archivos: [...new Set([...(c.archivos || []), ...nuevas.archivos])], areas, caminos, prs, actualizadoEn: ahora };
}

/** PR que se usan para el amarre (los marcados «usar»). */
export const prsActivos = capas => ((capas && capas.prs) || []).filter(p => p.usar !== false);

/** El área de trabajo principal del proyecto (la de mayor superficie), o null. */
export function areaPrincipal(capas) {
  const as = (capas && capas.areas) || [];
  return as.length ? as.reduce((m, a) => (a.ha > m.ha ? a : m), as[0]) : null;
}

/** Texto corto del estado de las capas: «1 área de 140 ha · 11 PR · 14 caminos». */
export function resumenCapas(capas) {
  if (!capas || (!(capas.prs || []).length && !(capas.caminos || []).length && !(capas.areas || []).length)) return '';
  const pr = prsActivos(capas).length, cam = (capas.caminos || []).length, ar = (capas.areas || []);
  const ha = ar.reduce((s, a) => s + (a.ha || 0), 0);
  return [ar.length && `${ar.length} área${ar.length === 1 ? '' : 's'} de ${ha.toLocaleString('es-CL', { maximumFractionDigits: 1 })} ha`, pr && `${pr} PR`, cam && `${cam} camino${cam === 1 ? '' : 's'}`].filter(Boolean).join(' · ');
}
