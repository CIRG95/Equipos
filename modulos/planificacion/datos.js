// modulos/planificacion/datos.js — almacenes de Planificación (Sistema v0.15). Prefijo planif_, se sincronizan con la nube.
//   planif_redes    red geodésica de un proyecto: área (KMZ), caminos, puntos (PR y control), vectores y parámetros   índice proyectoId
//   planif_marcas   marcas de vuelo (GCP) de un proyecto: área o eje, espaciado y marcas de control y de chequeo      índice proyectoId
// Coordenadas en [lon, lat] (WGS84 / SIRGAS). Los cálculos se hacen en metros con modelo.js.

import { registrarAlmacenes, obtener, todos, guardar, porIndice } from '../../compartido/almacen.js';
import { sellar } from '../../compartido/util.js';
import { enviarAPapelera, restaurar } from '../../compartido/papelera.js';

export const VERSION_MODULO = '0.1';
export const SCHEMA_VERSION = 1;
export const ALM = { redes: 'planif_redes', marcas: 'planif_marcas' };
export const DEFINICIONES = [{ nombre: ALM.redes, indices: [['proyectoId', 'proyectoId']] }, { nombre: ALM.marcas, indices: [['proyectoId', 'proyectoId']] }];

let persona = null;
export function iniciarDatos({ personaId = null } = {}) { registrarAlmacenes(DEFINICIONES); persona = personaId; }
export function fijarPersona(p) { persona = p; }
const sello = r => sellar(r, { personaId: persona, schemaVersion: SCHEMA_VERSION });
const vivo = r => r && !r.eliminadoEn;

export const PARAMS_RED = { receptores: 3, a: 5, b: 1, tol: 20, nSugeridos: 6 };

export async function listarRedes() { return (await todos(ALM.redes)).filter(vivo); }
export async function listarMarcas() { return (await todos(ALM.marcas)).filter(vivo); }
export async function redesDeProyecto(id) { return (await porIndice(ALM.redes, 'proyectoId', id)).filter(vivo); }
export async function marcasDeProyecto(id) { return (await porIndice(ALM.marcas, 'proyectoId', id)).filter(vivo); }
export async function obtenerRed(id) { const r = await obtener(ALM.redes, id); return vivo(r) ? r : null; }
export async function obtenerMarcas(id) { const r = await obtener(ALM.marcas, id); return vivo(r) ? r : null; }
export async function guardarRed(r) { return guardar(ALM.redes, sello({ params: { ...PARAMS_RED }, puntos: [], vectores: [], caminos: [], ...r })); }
export async function guardarMarcas(r) { return guardar(ALM.marcas, sello({ modo: 'area', espaciado: 150, ancho: 100, marcas: [], ...r })); }
export async function eliminar(almacen, id) { return enviarAPapelera(almacen, id, { personaId: persona }); }
export async function deshacer(almacen, id) { return restaurar(almacen, id, { personaId: persona }); }
