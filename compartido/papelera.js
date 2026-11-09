// compartido/papelera.js — borrado suave común a todos los módulos.
// Un registro en la papelera lleva eliminadoEn / eliminadoPor; nunca se borra solo.

import { obtener, guardar, todos, almacenesRegistrados } from './almacen.js';
import { ahoraISO, sellar } from './util.js';

export function estaEliminado(r) { return !!(r && r.eliminadoEn); }
/** v0.11.3: eliminado definitivamente (queda solo una marca vacía para que la sincronización no lo reviva). */
export function estaPurgado(r) { return !!(r && r.purgadoEn); }

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
    for (const r of await todos(nombre)) if (estaEliminado(r) && !estaPurgado(r)) salida.push({ almacen: nombre, registro: r });
  }
  return salida.sort((a, b) => b.registro.eliminadoEn.localeCompare(a.registro.eliminadoEn));
}

/**
 * v0.11.3 · Eliminar definitivamente desde la papelera. El registro se reemplaza por una marca vacía
 * ({ id, eliminadoEn, purgadoEn } + sellos): los datos desaparecen y, como la marca es más reciente, la
 * sincronización no lo trae de vuelta desde otro dispositivo. Sus archivos (fotos, PDF) se vacían igual.
 */
export async function eliminarDefinitivo(almacen, id, { personaId = null } = {}) {
  const r = await obtener(almacen, id);
  if (!r) return null;
  const marca = { id: r.id, eliminadoEn: r.eliminadoEn || ahoraISO(), eliminadoPor: r.eliminadoPor ?? personaId, purgadoEn: ahoraISO(),
    creadoEn: r.creadoEn, creadoPor: r.creadoPor, dispositivoId: r.dispositivoId };
  sellar(marca, { personaId, schemaVersion: r.schemaVersion || 1 });
  await guardar(almacen, marca);
  if (almacen !== 'compartido_archivos' && almacenesRegistrados().includes('compartido_archivos')) {
    for (const a of await todos('compartido_archivos')) {
      if (a.duenoId === id && !a.purgadoEn) await eliminarDefinitivo('compartido_archivos', a.id, { personaId });
    }
  }
  return marca;
}
