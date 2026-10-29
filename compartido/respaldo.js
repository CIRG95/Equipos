// compartido/respaldo.js — respaldo .json de la base (todos los módulos o solo algunos prefijos).
// Al importar se mezcla por id: gana el registro con actualizadoEn más reciente. Nada se borra.

import { todos, guardarVarios, almacenesRegistrados, obtener } from './almacen.js';
import { ahoraISO, dispositivoId, hoyISO, descargar } from './util.js';

export async function exportarRespaldo(prefijos = ['']) {
  const almacenes = {};
  for (const nombre of almacenesRegistrados()) {
    if (prefijos.some(p => nombre.startsWith(p))) almacenes[nombre] = await todos(nombre);
  }
  return { app: 'topoland', formato: 1, exportadoEn: ahoraISO(), dispositivoId: dispositivoId(), almacenes };
}

export async function descargarRespaldo(prefijos, nombreBase = 'respaldo') {
  const datos = await exportarRespaldo(prefijos);
  descargar(`${nombreBase}_${hoyISO()}.json`, JSON.stringify(datos, null, 2));
  return datos;
}

export async function importarRespaldo(datos) {
  if (!datos || datos.app !== 'topoland' || !datos.almacenes) throw new Error('El archivo no es un respaldo válido.');
  const conocidos = new Set(almacenesRegistrados());
  const resumen = { nuevos: 0, actualizados: 0, sinCambio: 0, omitidosAlmacen: [] };
  const ops = [];
  for (const [nombre, registros] of Object.entries(datos.almacenes)) {
    if (!conocidos.has(nombre)) { resumen.omitidosAlmacen.push(nombre); continue; }
    for (const r of registros) {
      if (!r || !r.id) continue;
      const actual = await obtener(nombre, r.id);
      if (!actual) { ops.push({ almacen: nombre, registro: r }); resumen.nuevos++; }
      else if ((r.actualizadoEn || '') > (actual.actualizadoEn || '')) { ops.push({ almacen: nombre, registro: r }); resumen.actualizados++; }
      else resumen.sinCambio++;
    }
  }
  await guardarVarios(ops);
  return resumen;
}
