// modulos/gastos/datos.js — almacenes del módulo Gastos (prefijo gastos_, se sincronizan con la nube).
//   gastos_gastos        un gasto con su boleta (archivoId en compartido_archivos)   índices proyectoId, personaId, rendicionId
//   gastos_rendiciones   N°, persona y proyecto; se crea al enviar                    índices proyectoId, personaId
//   gastos_eventos       solo se agregan: enviada, devuelta, pagada, deposito         índice rendicionId
// La boleta va en compartido_archivos con modulo 'gastos', duenoTipo 'gasto', duenoId = id del gasto (foto a 1600 px).

import { registrarAlmacenes, obtener, todos, guardar, guardarVarios } from '../../compartido/almacen.js';
import { sellar, hoyISO } from '../../compartido/util.js';
import { enviarAPapelera, restaurar, eliminarDefinitivo } from '../../compartido/papelera.js';
import { guardarArchivo, archivoAPapelera, urlArchivo } from '../../compartido/archivos.js';
import { numeroSiguiente, estadoRendicion, eventosDe } from './modelo.js';

export const VERSION_MODULO = '0.1a';
export const SCHEMA_VERSION = 1;
export const ALM = { gastos: 'gastos_gastos', rendiciones: 'gastos_rendiciones', eventos: 'gastos_eventos' };

let persona = null;
export function iniciarDatos({ personaId = null } = {}) {
  registrarAlmacenes([
    { nombre: ALM.gastos, indices: [['proyectoId', 'proyectoId'], ['personaId', 'personaId'], ['rendicionId', 'rendicionId']] },
    { nombre: ALM.rendiciones, indices: [['proyectoId', 'proyectoId'], ['personaId', 'personaId']] },
    { nombre: ALM.eventos, indices: [['rendicionId', 'rendicionId']] },
  ]);
  persona = personaId;
}
export function fijarPersona(p) { persona = p; }
const sello = r => sellar(r, { personaId: persona, schemaVersion: SCHEMA_VERSION });
const vivo = r => r && !r.eliminadoEn;

/** Todo el módulo de una vez (los volúmenes son chicos): { gastos, rendiciones, eventos }, sin lo que está en la papelera. */
export async function cargarTodo() {
  const [gastos, rendiciones, eventos] = await Promise.all([todos(ALM.gastos), todos(ALM.rendiciones), todos(ALM.eventos)]);
  return { gastos: gastos.filter(vivo), rendiciones: rendiciones.filter(vivo), eventos: eventos.filter(vivo) };
}

export async function obtenerGasto(id) { const g = await obtener(ALM.gastos, id); return vivo(g) ? g : null; }

/**
 * Guarda un gasto y, si viene, su boleta. archivo: File (foto o PDF) o null.
 * carpeta: ruta lógica de la boleta en la nube (p. ej. «Gastos/Planta Solar/Camilo Reyes»).
 */
export async function guardarGasto(gasto, { archivo = null, carpeta = null } = {}) {
  const g = sello({ ...gasto });
  delete g.tieneBoletaNueva;
  if (archivo) {
    const anterior = g.archivoId;
    const a = await guardarArchivo(archivo, { modulo: 'gastos', duenoTipo: 'gasto', duenoId: g.id, rol: 'boleta', proyectoId: g.proyectoId, carpeta }, { personaId: persona });
    g.archivoId = a.id;
    if (anterior) await archivoAPapelera(anterior, { personaId: persona });
  }
  if (g.sinBoleta && g.archivoId) { await archivoAPapelera(g.archivoId, { personaId: persona }); g.archivoId = null; }
  return guardar(ALM.gastos, g);
}

/**
 * v0.14a · RRHH elimina una rendición (va a la papelera de rendiciones, con Restaurar).
 * modo 'borrador': sus gastos vuelven al borrador de la cuenta (persona × proyecto).
 * modo 'todo': sus gastos y los depósitos ligados a ella también van a la papelera (para limpiar pruebas).
 * Lo que se hizo queda anotado en la rendición (eliminacion) para poder restaurarla igual.
 */
export async function eliminarRendicion(id, { modo = 'borrador' } = {}) {
  const r = await obtener(ALM.rendiciones, id);
  if (!vivo(r)) return null;
  const d = await cargarTodo();
  const gastos = d.gastos.filter(g => g.rendicionId === id);
  const deps = modo === 'todo' ? d.eventos.filter(e => e.tipo === 'deposito' && e.rendicionId === id) : [];
  await guardar(ALM.rendiciones, sello({ ...r, eliminacion: { modo, gastoIds: gastos.map(g => g.id), depositoIds: deps.map(e => e.id) } }));
  await enviarAPapelera(ALM.rendiciones, id, { personaId: persona });
  if (modo === 'todo') {
    for (const g of gastos) await enviarAPapelera(ALM.gastos, g.id, { personaId: persona });
    for (const e of deps) await enviarAPapelera(ALM.eventos, e.id, { personaId: persona });
  } else {
    await guardarVarios(gastos.map(g => ({ almacen: ALM.gastos, registro: sello({ ...g, rendicionId: null }) })));
  }
  return r;
}

/** Restaura una rendición eliminada tal como estaba. Si su N° ya lo usa otra rendición de la persona, toma el siguiente libre. */
export async function restaurarRendicion(id) {
  const r = await obtener(ALM.rendiciones, id);
  if (!r || r.purgadoEn) return null;
  const el = r.eliminacion || { modo: 'borrador', gastoIds: [], depositoIds: [] };
  await restaurar(ALM.rendiciones, id, { personaId: persona });
  if (el.modo === 'todo') {
    for (const gid of el.gastoIds) await restaurar(ALM.gastos, gid, { personaId: persona });
    for (const eid of el.depositoIds) await restaurar(ALM.eventos, eid, { personaId: persona });
  } else {
    for (const gid of el.gastoIds) {
      const g = await obtener(ALM.gastos, gid);
      if (vivo(g) && !g.rendicionId) await guardar(ALM.gastos, sello({ ...g, rendicionId: id }));
    }
  }
  const d = await cargarTodo();
  const vuelta = await obtener(ALM.rendiciones, id);
  delete vuelta.eliminacion;
  const choca = d.rendiciones.some(x => x.id !== id && x.personaId === vuelta.personaId && x.numero === vuelta.numero);
  if (choca) vuelta.numero = numeroSiguiente(d.rendiciones.filter(x => x.id !== id), vuelta.personaId);
  await guardar(ALM.rendiciones, sello(vuelta));
  return vuelta;
}

/** Rendiciones en la papelera (más recientes primero). */
export async function rendicionesEliminadas() {
  return (await todos(ALM.rendiciones)).filter(r => r.eliminadoEn && !r.purgadoEn).sort((a, b) => b.eliminadoEn.localeCompare(a.eliminadoEn));
}

/** Elimina definitivamente una rendición de la papelera, con sus eventos y, si se eliminó «con todo», sus gastos (y boletas) y depósitos. */
export async function purgarRendicion(id) {
  const r = await obtener(ALM.rendiciones, id);
  if (!r || !r.eliminadoEn || r.purgadoEn) return null;
  const el = r.eliminacion || { modo: 'borrador', gastoIds: [], depositoIds: [] };
  const evs = (await todos(ALM.eventos)).filter(e => e.rendicionId === id && !e.purgadoEn && (e.tipo !== 'deposito' || el.depositoIds.includes(e.id)));
  for (const e of evs) await eliminarDefinitivo(ALM.eventos, e.id, { personaId: persona });
  for (const eid of el.depositoIds) await eliminarDefinitivo(ALM.eventos, eid, { personaId: persona });
  if (el.modo === 'todo') {
    const ids = new Set(el.gastoIds);
    // Boletas (incluidas las reemplazadas que quedaron en la papelera) se borran también, ya que su gasto desaparece.
    for (const a of await todos('compartido_archivos')) {
      if (a.modulo === 'gastos' && ids.has(a.duenoId) && !a.purgadoEn) await eliminarDefinitivo('compartido_archivos', a.id, { personaId: persona });
    }
    for (const gid of el.gastoIds) await eliminarDefinitivo(ALM.gastos, gid, { personaId: persona });
  }
  return eliminarDefinitivo(ALM.rendiciones, id, { personaId: persona });
}

export async function gastoAPapelera(id) { return enviarAPapelera(ALM.gastos, id, { personaId: persona }); }
export async function restaurarGasto(id) { return restaurar(ALM.gastos, id, { personaId: persona }); }

const evento = (datos, orden = 0) => ({ almacen: ALM.eventos, registro: sello({ fecha: hoyISO(), por: persona, orden, ...datos }) });

/**
 * Envía la rendición de una cuenta (persona × proyecto). Los gastos sin enviar de la cuenta entran en ella.
 * Si hay una rendición devuelta de esa cuenta, se reenvía esa misma (mismo N°) con sus gastos corregidos
 * más los nuevos. Devuelve la rendición.
 */
export async function enviarRendicion({ personaId, proyectoId, rendicionId = null }) {
  const { gastos, rendiciones, eventos } = await cargarTodo();
  let r = rendicionId ? rendiciones.find(x => x.id === rendicionId) : null;
  if (r && estadoRendicion(eventosDe(eventos, r.id)) !== 'devuelta') throw new Error('Esta rendición ya está enviada.');
  const sinEnviar = gastos.filter(g => g.personaId === personaId && g.proyectoId === proyectoId && !g.rendicionId);
  const propios = r ? gastos.filter(g => g.rendicionId === r.id) : [];
  const incluidos = [...propios, ...sinEnviar];
  if (!incluidos.length) throw new Error('No hay gastos para enviar.');
  if (!r) r = sello({ numero: numeroSiguiente(rendiciones, personaId), personaId, proyectoId });
  const ops = [{ almacen: ALM.rendiciones, registro: r }];
  for (const g of sinEnviar) ops.push({ almacen: ALM.gastos, registro: sello({ ...g, rendicionId: r.id }) });
  const total = incluidos.reduce((t, g) => t + (Number(g.monto) || 0), 0);
  ops.push(evento({ tipo: 'enviada', rendicionId: r.id, personaId, proyectoId, gastoIds: incluidos.map(g => g.id), total }));
  await guardarVarios(ops);
  return r;
}

/** RRHH devuelve la rendición con un motivo y, si quiere, los gastos observados. */
export async function devolverRendicion(r, { motivo, observados = [] }) {
  if (!String(motivo || '').trim()) throw new Error('Escribe el motivo para que la persona sepa qué corregir.');
  await guardarVarios([evento({ tipo: 'devuelta', rendicionId: r.id, personaId: r.personaId, proyectoId: r.proyectoId, motivo: motivo.trim(), observados })]);
}

/** RRHH cierra la rendición: pago a la persona (monto) o reintegro de la persona (reintegro). */
export async function pagarRendicion(r, { fecha = hoyISO(), monto = 0, reintegro = 0, nota = '', saldo = 0 }) {
  await guardarVarios([evento({ tipo: 'pagada', rendicionId: r.id, personaId: r.personaId, proyectoId: r.proyectoId, fecha, monto: Math.max(0, Math.round(monto) || 0), reintegro: Math.max(0, Math.round(reintegro) || 0), nota, saldo })]);
}

/** RRHH registra un depósito de fondo por rendir (antes o después de gastar). rendicionId opcional. */
export async function registrarDeposito({ personaId, proyectoId, monto, fecha = hoyISO(), rendicionId = null, nota = '' }) {
  if (!personaId || !proyectoId) throw new Error('Elige la persona y el proyecto del depósito.');
  if (!(monto > 0)) throw new Error('Falta el monto del depósito.');
  await guardarVarios([evento({ tipo: 'deposito', personaId, proyectoId, rendicionId, monto: Math.round(monto), fecha, nota })]);
}

/** Un depósito registrado por error se manda a la papelera (los demás eventos no se borran). */
export async function quitarDeposito(id) { return enviarAPapelera(ALM.eventos, id, { personaId: persona }); }
export async function restaurarDeposito(id) { return restaurar(ALM.eventos, id, { personaId: persona }); }

/** Contenido de la boleta (dataURL) para el PDF; si está solo en la nube, se baja una vez. */
export async function datosBoleta(archivoId) {
  if (!archivoId) return null;
  let a = await obtener('compartido_archivos', archivoId);
  if (!vivo(a)) return null;
  if (!a.datos) {
    await urlArchivo(archivoId);
    a = await obtener('compartido_archivos', archivoId);
  }
  return a && a.datos ? { datos: a.datos, mime: a.mime, nombre: a.nombre } : null;
}
