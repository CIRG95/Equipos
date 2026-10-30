// modulos/vuelos/datos.js — almacenes del módulo Vuelos (prefijo vuelos_).

import { registrarAlmacenes, obtener, todos, porIndice, guardar, borrarDefinitivo } from '../../compartido/almacen.js';
import { sellar } from '../../compartido/util.js';
import { enviarAPapelera } from '../../compartido/papelera.js';
import { DRONES_BASE } from './drones.js';

export const VERSION_MODULO = '0.3';
export const SCHEMA_VERSION = 2; // 2: hoja de vuelo (área, clima, permisos)
export const ALM = { planes: 'vuelos_planes', drones: 'vuelos_drones' };
// Las capas de zonas pueden pesar varios MB: quedan solo en este equipo (sin prefijo vuelos_, la nube no las sube).
const ALM_CAPAS = 'local_vuelos_capas';

let persona = null;
export function iniciarDatos({ personaId = null } = {}) {
  registrarAlmacenes([{ nombre: ALM.planes, indices: [['proyectoId', 'proyectoId']] }, { nombre: ALM.drones }, { nombre: ALM_CAPAS }]);
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

// ─────────── Capas de zonas cargadas por el usuario ───────────
export async function listarCapasUsuario() { return (await todos(ALM_CAPAS)).filter(vivo); }
export async function guardarCapaUsuario(capa) { return guardar(ALM_CAPAS, sello({ ...capa }), { silencioso: true }); }
export async function borrarCapaUsuario(id) { return borrarDefinitivo(ALM_CAPAS, id); }
