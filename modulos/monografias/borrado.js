// modulos/monografias/borrado.js — eliminar, restaurar y eliminar definitivamente una monografía (v0.12).
// Una ficha puede existir en dos almacenes (la que envió Terreno y la revisada en gabinete): se tratan juntas.
// Va aparte de datos.js porque datos.js forma parte del paquete de conexión de Terreno y debe quedar igual.
// Si Terreno vuelve a enviar una monografía eliminada, reaparece (es un envío nuevo).

import { obtener, porIndice } from '../../compartido/almacen.js';
import { enviarAPapelera, restaurar, eliminarDefinitivo } from '../../compartido/papelera.js';
import { ALM } from './datos.js';

const ALMS = [ALM.mono, ALM.gabinete];

export async function eliminarMonografia(id, personaId = null) {
  for (const a of ALMS) { const r = await obtener(a, id); if (r && !r.eliminadoEn) await enviarAPapelera(a, id, { personaId }); }
}
export async function restaurarMonografia(id, personaId = null) {
  for (const a of ALMS) { const r = await obtener(a, id); if (r && r.eliminadoEn && !r.purgadoEn) await restaurar(a, id, { personaId }); }
}
/** Borra los datos y sus archivos (croquis, fotos); queda solo una marca para que la sincronización no la reviva. */
export async function purgarMonografia(id, personaId = null) {
  for (const a of ALMS) { const r = await obtener(a, id); if (r && !r.purgadoEn) await eliminarDefinitivo(a, id, { personaId }); }
}
/** Monografías del proyecto que están en la papelera: [{ id, ficha, eliminadoEn }], la más reciente primero. */
export async function papeleraDeProyecto(proyectoId) {
  const por = new Map();
  for (const a of ALMS) for (const r of await porIndice(a, 'proyectoId', proyectoId)) {
    if (!r.eliminadoEn || r.purgadoEn) continue;
    const previo = por.get(r.id);
    if (!previo || a === ALM.gabinete) por.set(r.id, { id: r.id, ficha: r, eliminadoEn: r.eliminadoEn });
  }
  return [...por.values()].sort((x, y) => y.eliminadoEn.localeCompare(x.eliminadoEn));
}
