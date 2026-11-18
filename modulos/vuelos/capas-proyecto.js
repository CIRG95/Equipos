// modulos/vuelos/capas-proyecto.js — capas del proyecto (Sistema v0.17): caminos y PR existentes desde KMZ/KML.
// Se cargan una vez en el proyecto y las usan Vuelos (bases de amarre, despegue sobre caminos) y Planificación.
// En el KMZ: las líneas son caminos y los puntos son PR ya instalados (con su nombre). Los puntos sin nombre útil
// («Marcador sin título») se guardan desactivados para que el encargado decida si son PR.
//
// Se guardan en el registro del proyecto (compartido_proyectos), sin almacenes nuevos:
//   p.capas = { archivos: [nombre], caminos: [{ nombre, linea: [[lon, lat]…] }], prs: [{ id, nombre, lon, lat, usar }], actualizadoEn }

import { leerArchivo, leerCapa } from './kml.js';
import { simplificarLL } from './redvial.js';
import { esNombreGenerico } from './amarre.js';

const TOL_LL = 0.00003; // ≈ 3 m: los caminos se simplifican para que el proyecto no pese de más al sincronizar
const r6 = x => Math.round(x * 1e6) / 1e6;

/** Lee uno o más KMZ/KML y devuelve { caminos, prs, poligonos, archivos }. */
export async function leerCapasDeArchivos(archivos) {
  const out = { caminos: [], prs: [], poligonos: 0, archivos: [] };
  for (const f of [...archivos]) {
    const elementos = leerCapa(await leerArchivo(f));
    out.archivos.push(f.name);
    for (const e of elementos) {
      if (e.tipo === 'linea') out.caminos.push({ nombre: e.nombre || '', linea: simplificarLL(e.coords, TOL_LL).map(([x, y]) => [r6(x), r6(y)]) });
      else if (e.tipo === 'punto') out.prs.push({ nombre: (e.nombre || '').trim(), lon: r6(e.coords[0]), lat: r6(e.coords[1]) });
      else out.poligonos++;
    }
  }
  return out;
}

const clavePR = p => `${p.nombre.toLowerCase()}|${p.lon.toFixed(5)}|${p.lat.toFixed(5)}`;

/** Suma lo leído a las capas existentes del proyecto (sin repetir PR ni caminos). */
export function fusionarCapas(previas, nuevas, ahora = new Date().toISOString()) {
  const c = { archivos: [], caminos: [], prs: [], ...(previas || {}) };
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
  return { archivos: [...new Set([...(c.archivos || []), ...nuevas.archivos])], caminos, prs, actualizadoEn: ahora };
}

/** PR que se usan para el amarre (los marcados «usar»). */
export const prsActivos = capas => ((capas && capas.prs) || []).filter(p => p.usar !== false);

/** Texto corto del estado de las capas: «11 PR · 14 caminos». */
export function resumenCapas(capas) {
  if (!capas || (!(capas.prs || []).length && !(capas.caminos || []).length)) return '';
  const pr = prsActivos(capas).length, cam = (capas.caminos || []).length;
  return [pr && `${pr} PR`, cam && `${cam} camino${cam === 1 ? '' : 's'}`].filter(Boolean).join(' · ');
}
