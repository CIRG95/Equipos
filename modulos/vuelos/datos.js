// modulos/vuelos/datos.js — almacenes del módulo Vuelos (prefijo vuelos_).

import { registrarAlmacenes, obtener, todos, porIndice, guardar } from '../../compartido/almacen.js';
import { sellar } from '../../compartido/util.js';
import { enviarAPapelera } from '../../compartido/papelera.js';
import { DRONES_BASE } from './drones.js';

export const VERSION_MODULO = '0.1';
export const SCHEMA_VERSION = 1;
export const ALM = { planes: 'vuelos_planes', drones: 'vuelos_drones' };

let persona = null;
export function iniciarDatos({ personaId = null } = {}) {
  registrarAlmacenes([{ nombre: ALM.planes, indices: [['proyectoId', 'proyectoId']] }, { nombre: ALM.drones }]);
  persona = personaId;
}
export function fijarPersona(p) { persona = p; }
const sello = r => sellar(r, { personaId: persona, schemaVersion: SCHEMA_VERSION });
const vivo = r => !r.eliminadoEn;

/** Catálogo de drones con las correcciones guardadas por el usuario encima de los valores de fábrica. */
export async function listarDrones() {
  const cambios = Object.fromEntries((await todos(ALM.drones)).filter(vivo).map(d => [d.id, d]));
  return DRONES_BASE.map(d => ({ ...d, ...(cambios[d.id] ? limpiarCambios(cambios[d.id]) : {}), corregido: !!cambios[d.id] }));
}
function limpiarCambios(c) {
  const { creadoEn, creadoPor, actualizadoEn, dispositivoId, modificadoPor, schemaVersion, ...resto } = c;
  return resto;
}
export async function guardarDron(id, valores) {
  const actual = (await obtener(ALM.drones, id)) || { id };
  delete actual.eliminadoEn; delete actual.eliminadoPor; // vuelve a valer si se había restablecido
  return guardar(ALM.drones, sello({ ...actual, ...valores, id }));
}
export async function restablecerDron(id) { return enviarAPapelera(ALM.drones, id, { personaId: persona }); }

export async function listarPlanes() { return (await todos(ALM.planes)).filter(vivo).sort((a, b) => (b.actualizadoEn || '').localeCompare(a.actualizadoEn || '')); }
export async function planesDeProyecto(proyectoId) { return (await porIndice(ALM.planes, 'proyectoId', proyectoId)).filter(vivo); }
export async function obtenerPlan(id) { const p = await obtener(ALM.planes, id); return p && vivo(p) ? p : null; }
export async function guardarPlan(plan) { return guardar(ALM.planes, sello({ ...plan })); }
export async function eliminarPlan(id) { return enviarAPapelera(ALM.planes, id, { personaId: persona }); }
