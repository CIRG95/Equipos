// modulos/planificacion/planificacion.js — PUERTA DE ENTRADA del módulo Planificación (Planificación 0.1, Sistema v0.15).
// Red geodésica GNSS (PR, vectores, pre-análisis, sesiones y tiempos según la tabla de la empresa) y marcas de vuelo (GCP).

import { iniciarDatos, fijarPersona, VERSION_MODULO, ALM, redesDeProyecto, marcasDeProyecto, listarRedes } from './datos.js';
import { montarPantallas } from './pantallas.js';

export const VERSION = VERSION_MODULO;
export const ALMACENES = Object.values(ALM);

let iniciado = false;
export function iniciar({ personaId } = {}) {
  if (!iniciado) { iniciarDatos({ personaId: personaId ?? null }); iniciado = true; }
  else if (personaId !== undefined) fijarPersona(personaId);
}

/** contexto: { rol, personaId, vista: null | 'proyecto' | 'red' | 'marcas', id, avisar } → { desmontar, refrescar } */
export function montar(contenedor, contexto) {
  iniciar({ personaId: contexto.personaId });
  return montarPantallas(contenedor, contexto);
}

/** Resumen para la ficha del proyecto: redes y marcas con su conteo. */
export async function resumenDeProyecto(proyectoId) {
  iniciar();
  const [redes, marcas] = await Promise.all([redesDeProyecto(proyectoId), marcasDeProyecto(proyectoId)]);
  return { redes, marcas };
}

/** PR y puntos de control de todas las redes (para el mapa de puntos propios de Conocimiento y el buscador). */
export async function puntosDeRedes() {
  iniciar();
  return (await listarRedes()).flatMap(r => (r.puntos || []).map(p => ({ ...p, redId: r.id, proyectoId: r.proyectoId })));
}
