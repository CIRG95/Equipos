// modulos/vuelos/vuelos.js — PUERTA DE ENTRADA del módulo Vuelos.
// Planificador (GSD, líneas, fotos, tiempo, baterías, densidad LiDAR), limpiador de KML/KMZ para DJI Pilot 2
// y pronóstico por hora. Otros módulos y la app global solo importan este archivo.

import { iniciarDatos, fijarPersona, planesDeProyecto as planesCrudos, listarDrones, VERSION_MODULO, ALM } from './datos.js';
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
