// modulos/seguimiento/datos.js — almacenes del módulo Seguimiento (prefijo seguimiento_, se sincronizan con la nube).
//   seguimiento_planes    plantilla por proyecto (columnas, áreas y tramos, plazo)        índice proyectoId
//   seguimiento_ciclos    un mes del servicio (o el trabajo único): nombre, N° de mes, datos   índice planId
//   seguimiento_eventos   cambios de estado, solo se agregan (terreno, producto, entrega, nota)  índice cicloId
//   seguimiento_entregas  entregas del ciclo (E1, E2…) con su fecha                       índice cicloId

import { registrarAlmacenes, obtener, todos, porIndice, guardar, guardarVarios } from '../../compartido/almacen.js';
import { sellar, uuid } from '../../compartido/util.js';
import { enviarAPapelera } from '../../compartido/papelera.js';

export const VERSION_MODULO = '0.2';
export const SCHEMA_VERSION = 1;
export const ALM = { planes: 'seguimiento_planes', ciclos: 'seguimiento_ciclos', eventos: 'seguimiento_eventos', entregas: 'seguimiento_entregas' };

let persona = null;
export function iniciarDatos({ personaId = null } = {}) {
  registrarAlmacenes([
    { nombre: ALM.planes, indices: [['proyectoId', 'proyectoId']] },
    { nombre: ALM.ciclos, indices: [['planId', 'planId']] },
    { nombre: ALM.eventos, indices: [['cicloId', 'cicloId']] },
    { nombre: ALM.entregas, indices: [['cicloId', 'cicloId']] },
  ]);
  persona = personaId;
}
export function fijarPersona(p) { persona = p; }
export const personaActual = () => persona;
export const nuevoId = () => uuid();
const sello = r => sellar(r, { personaId: persona, schemaVersion: SCHEMA_VERSION });
const vivo = r => !r.eliminadoEn;
const recientes = (a, b) => (b.creadoEn || '').localeCompare(a.creadoEn || '');

export async function listarPlanes() { return (await todos(ALM.planes)).filter(vivo); }
export async function planDeProyecto(proyectoId) { return (await porIndice(ALM.planes, 'proyectoId', proyectoId)).filter(vivo)[0] || null; }
export async function guardarPlan(plan) { return guardar(ALM.planes, sello({ ...plan })); }
export async function eliminarPlan(id) { return enviarAPapelera(ALM.planes, id, { personaId: persona }); }

export async function ciclosDePlan(planId) { return (await porIndice(ALM.ciclos, 'planId', planId)).filter(vivo).sort(recientes); }
export async function guardarCiclo(ciclo) { return guardar(ALM.ciclos, sello({ ...ciclo })); }

export async function eventosDeCiclo(cicloId) { return (await porIndice(ALM.eventos, 'cicloId', cicloId)).filter(vivo); }
/** Agrega eventos (nunca se editan). Mismo instante para todos, con «orden» para desempatar. */
export async function agregarEventos(eventos) {
  const ahora = new Date().toISOString();
  await guardarVarios(eventos.map(e => ({ almacen: ALM.eventos, registro: sello({ ...e, creadoEn: ahora }) })));
}

export async function entregasDeCiclo(cicloId) { return (await porIndice(ALM.entregas, 'cicloId', cicloId)).filter(vivo).sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true })); }
export async function guardarEntrega(entrega) { return guardar(ALM.entregas, sello({ ...entrega })); }
