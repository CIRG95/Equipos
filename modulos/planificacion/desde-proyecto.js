// modulos/planificacion/desde-proyecto.js — v0.18: la red de PR y las marcas de vuelo parten del KMZ del proyecto.
// Un solo KMZ por proyecto (Planificación › Área y capas): el área, los caminos y los PR existentes. A eso se suman
// los PR nuevos que piden los vuelos para amarrarse (hoja.resumen.amarre.nuevosLL). Sin pantalla: se prueba en node.

import { areaPrincipal, prsActivos } from '../vuelos/capas-proyecto.js';

const norm = t => String(t || '').trim().toLowerCase();

/** Puntos de la red que vienen del proyecto: PR existentes (control) y PR nuevos del amarre de los vuelos (PR). */
export function puntosDelProyecto(proyecto, hojas = []) {
  const puntos = [];
  for (const x of prsActivos(proyecto && proyecto.capas)) {
    puntos.push({ id: `cap-${x.id}`, nombre: x.nombre, tipo: 'control', lat: x.lat, lon: x.lon, nota: 'PR existente (capas del proyecto)', origen: 'capas' });
  }
  for (const h of hojas) {
    const am = h && h.resumen && h.resumen.amarre;
    for (const b of (am && am.nuevosLL) || []) {
      if (puntos.some(p => norm(p.nombre) === norm(b.nombre))) continue;
      puntos.push({ id: `am-${h.id}-${norm(b.nombre).replace(/[^a-z0-9]+/g, '-')}`, nombre: b.nombre, tipo: 'pr', lat: b.lat, lon: b.lon, nota: `PR nuevo para el amarre del vuelo «${h.nombre || 'Hoja de vuelo'}»`, origen: 'amarre' });
    }
  }
  return puntos;
}

/** Datos con que nace una red de PR del proyecto. */
export function semillaRed(proyecto, hojas = []) {
  const capas = (proyecto && proyecto.capas) || {};
  const a = areaPrincipal(capas);
  return {
    proyectoId: proyecto ? proyecto.id : null,
    nombre: 'Red de PR',
    area: a ? a.anillo : null,
    areaNombre: a ? `Área del proyecto · ${a.nombre}` : '',
    caminos: (capas.caminos || []).map(c => ({ nombre: c.nombre || 'Camino', linea: c.linea })),
    puntos: puntosDelProyecto(proyecto, hojas),
  };
}

/** Datos con que nace una distribución de marcas de vuelo del proyecto. */
export function semillaMarcas(proyecto) {
  const a = areaPrincipal(proyecto && proyecto.capas);
  return { proyectoId: proyecto ? proyecto.id : null, nombre: 'Marcas de vuelo', modo: 'area', area: a ? a.anillo : null, areaNombre: a ? `Área del proyecto · ${a.nombre}` : '' };
}

/** Suma a una red los puntos del proyecto que aún no tiene (por nombre). Devuelve { puntos, agregados }. */
export function sumarPuntosDelProyecto(red, proyecto, hojas = []) {
  const ya = new Set((red.puntos || []).map(p => norm(p.nombre)));
  const nuevos = puntosDelProyecto(proyecto, hojas).filter(p => !ya.has(norm(p.nombre)));
  return { puntos: [...(red.puntos || []), ...nuevos], agregados: nuevos.length };
}
