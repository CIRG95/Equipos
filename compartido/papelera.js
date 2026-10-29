// compartido/papelera.js — borrado suave común a todos los módulos.
// Un registro en la papelera lleva eliminadoEn / eliminadoPor; nunca se borra solo.

import { obtener, guardar, todos, almacenesRegistrados } from './almacen.js';
import { ahoraISO, sellar } from './util.js';

export function estaEliminado(r) { return !!(r && r.eliminadoEn); }

export async function enviarAPapelera(almacen, id, { personaId = null, schemaVersion = 1 } = {}) {
  const r = await obtener(almacen, id);
  if (!r) return null;
  r.eliminadoEn = ahoraISO();
  r.eliminadoPor = personaId;
  sellar(r, { personaId, schemaVersion: r.schemaVersion || schemaVersion });
  return guardar(almacen, r);
}

export async function restaurar(almacen, id, { personaId = null } = {}) {
  const r = await obtener(almacen, id);
  if (!r) return null;
  delete r.eliminadoEn;
  delete r.eliminadoPor;
  sellar(r, { personaId, schemaVersion: r.schemaVersion || 1 });
  return guardar(almacen, r);
}

/** Lista lo que está en la papelera, opcionalmente solo en almacenes con cierto prefijo. */
export async function enPapelera(prefijo = '') {
  const salida = [];
  for (const nombre of almacenesRegistrados()) {
    if (!nombre.startsWith(prefijo)) continue;
    for (const r of await todos(nombre)) if (estaEliminado(r)) salida.push({ almacen: nombre, registro: r });
  }
  return salida.sort((a, b) => b.registro.eliminadoEn.localeCompare(a.registro.eliminadoEn));
}
