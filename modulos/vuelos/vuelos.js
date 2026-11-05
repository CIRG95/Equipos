// modulos/vuelos/vuelos.js — PUERTA DE ENTRADA del módulo Vuelos.
// Planificador (GSD, líneas, fotos, tiempo, baterías, densidad LiDAR), limpiador de KML/KMZ para DJI Pilot 2
// y pronóstico por hora. Otros módulos y la app global solo importan este archivo.

import { iniciarDatos, fijarPersona, planesDeProyecto as planesCrudos, listarDrones, listarPlanes, VERSION_MODULO, ALM } from './datos.js';
import { migrarHoja, etapaVuelo, NOMBRE_ETAPA_VUELO, documentosPermiso } from './hoja.js';
import { montarPantallas } from './pantallas.js';

export const VERSION = VERSION_MODULO;
export const ALMACENES = Object.values(ALM);

let iniciado = false;
export function iniciar({ personaId } = {}) {
  if (!iniciado) { iniciarDatos({ personaId: personaId ?? null }); iniciado = true; }
  else if (personaId !== undefined) fijarPersona(personaId);
}

/** contexto: { rol, personaId, proyectoId?, planId?, tab? } → { desmontar(), refrescar() } */
export function montar(contenedor, contexto) {
  iniciar({ personaId: contexto.personaId });
  return montarPantallas(contenedor, contexto);
}

/** Planes de vuelo de un proyecto: [{ id, nombre, dronId, dron, resumen }] */
export async function planesDeProyecto(proyectoId) {
  iniciar();
  const [planes, drones] = await Promise.all([planesCrudos(proyectoId), listarDrones()]);
  return planes.map(p => ({ id: p.id, nombre: p.nombre, dronId: p.dronId, dron: (drones.find(d => d.id === p.dronId) || {}).nombre || p.dronId, resumen: p.resumen || {} }));
}

/** Todos los vuelos con su etapa (v0.11, para Inicio): [{ id, nombre, proyectoId, pilotoId, fecha, fechas, etapa, etapaTexto, logs, dgac, docsPendientes, resumen }] */
export async function listarVuelos() {
  iniciar();
  return (await listarPlanes()).map(migrarHoja).map(h => ({
    id: h.id, nombre: h.nombre || 'Vuelo sin nombre', proyectoId: h.proyectoId, pilotoId: h.pilotoId, fecha: h.fecha,
    fechas: Array.isArray(h.programa) && h.programa.length ? h.programa.map(x => x.fecha) : (h.fecha ? [h.fecha] : []),
    etapa: etapaVuelo(h), etapaTexto: NOMBRE_ETAPA_VUELO[etapaVuelo(h)], logs: (h.permisos.logs || []).length,
    dgac: h.permisos.dgac, docsPendientes: documentosPermiso(h).filter(x => !x.listo).length, resumen: h.resumen || {}, estado: h.estado,
  }));
}
