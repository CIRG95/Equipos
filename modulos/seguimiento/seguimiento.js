// modulos/seguimiento/seguimiento.js — PUERTA DE ENTRADA del módulo Seguimiento de entregas.
// Por proyecto: franja de terreno y gabinete por tramo, tabla de avance tramos × productos, entregas y plazo.
// La app de Terreno alimentará la columna Terreno (tramos volados); por ahora se marca aquí.

import { iniciarDatos, fijarPersona, planDeProyecto, ciclosDePlan, eventosDeCiclo, VERSION_MODULO, ALM } from './datos.js';
import { estadoCiclo, cuenta, plazoCiclo } from './modelo.js';
import { montarPantallas } from './pantallas.js';
import { hoyISO } from '../../compartido/util.js';

export const VERSION = VERSION_MODULO;
export const ALMACENES = Object.values(ALM);

let iniciado = false;
export function iniciar({ personaId } = {}) {
  if (!iniciado) { iniciarDatos({ personaId: personaId ?? null }); iniciado = true; }
  else if (personaId !== undefined) fijarPersona(personaId);
}

/** contexto: { rol, personaId, proyectoId?, tab? } → { desmontar(), refrescar() } */
export function montar(contenedor, contexto) {
  iniciar({ personaId: contexto.personaId });
  return montarPantallas(contenedor, contexto);
}

/** Resumen para la ficha del proyecto: null si no tiene seguimiento. */
export async function resumenDeProyecto(proyectoId) {
  iniciar();
  const plan = await planDeProyecto(proyectoId);
  if (!plan) return null;
  const ciclo = (await ciclosDePlan(plan.id))[0] || null;
  const tramos = plan.areas.flatMap(a => a.tramos);
  const est = ciclo ? estadoCiclo(await eventosDeCiclo(ciclo.id)) : {};
  return { plan, ciclo, cuenta: cuenta(plan, est, tramos), plazo: plazoCiclo(plan, ciclo, hoyISO()) };
}
