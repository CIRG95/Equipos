// modulos/monografias/monografias.js — PUERTA DE ENTRADA del módulo Monografías.
// Recibe por proyecto las monografías, jornadas y fotos que publica la app de Terreno (paquete de conexión 1.2),
// las revisa en gabinete (fotos, coordenadas finales, estado) y genera el PDF con el mismo código de Terreno.

import * as D from './datos.js';
import { montarPantallas } from './pantallas.js';

export const VERSION = '0.4'; // v0.12: paso a paso (datos.js conserva su versión porque va en el paquete de conexión)
export const ALMACENES = Object.values(D.ALM);

let iniciado = false;
export function iniciar({ personaId } = {}) {
  if (!iniciado) { D.iniciarDatos({ personaId: personaId ?? null }); iniciado = true; }
  else if (personaId !== undefined) D.fijarPersona(personaId);
}

/** contexto: { rol, personaId, proyectoId?, monografiaId? } → { desmontar() } */
export function montar(contenedor, contexto) {
  iniciar({ personaId: contexto.personaId });
  return montarPantallas(contenedor, contexto);
}

/** Para la ficha del proyecto: { total, porEstado, jornadas } */
export async function resumenDeProyecto(proyectoId) { iniciar(); return D.resumenDeProyecto(proyectoId); }

// ── Puertas para la app de Terreno (las usa el paquete de conexión) ──
export async function publicarMonografia(m, op) { iniciar(); return D.publicarMonografia(m, op); }
export async function publicarJornada(j, levs, op) { iniciar(); return D.publicarJornada(j, levs, op); }
export async function subirFoto(dataURL, op) { iniciar(); return D.guardarFoto(dataURL, op); }
export async function estadoMonografias(proyectoId) { iniciar(); return D.estadoMonografias(proyectoId); }
