// modulos/seguimiento/seguimiento.js — PUERTA DE ENTRADA del módulo Seguimiento de entregas.
// Por proyecto: franja de terreno y gabinete por tramo, tabla de avance tramos × productos, entregas y plazo.
// La app de Terreno alimentará la columna Terreno (tramos volados); por ahora se marca aquí.

import { iniciarDatos, fijarPersona, planDeProyecto, ciclosDePlan, eventosDeCiclo, agregarEventos, VERSION_MODULO, ALM } from './datos.js';
import { estadoCiclo, cuenta, plazoCiclo, estadoDe, prepararCambios } from './modelo.js';
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

/**
 * Tramos del mes actual de un proyecto, para la app de Terreno: { ciclo, areas: [{ nombre, tramos: [{ id, n, nombre, volado, fecha, por, nota }] }] }
 * o null si el proyecto no tiene seguimiento. Agregado en Sistema v0.6.
 */
export async function tramosDeProyecto(proyectoId) {
  iniciar();
  const plan = await planDeProyecto(proyectoId);
  if (!plan) return null;
  const ciclo = (await ciclosDePlan(plan.id))[0] || null;
  const est = ciclo ? estadoCiclo(await eventosDeCiclo(ciclo.id)) : {};
  return {
    ciclo: ciclo ? { id: ciclo.id, nombre: ciclo.nombre } : null,
    areas: plan.areas.map(a => ({ nombre: a.nombre, tramos: a.tramos.map(t => { const e = estadoDe(est, t.id); return { id: t.id, n: t.n, nombre: t.nombre, volado: !!e.terreno, fecha: e.terreno, por: e.por, nota: e.nota }; }) })),
  };
}

/** La app de Terreno marca un tramo volado (o lo desmarca con volado: false), con nota opcional. Evento de solo agregar. */
export async function marcarTramoVolado(proyectoId, tramoId, { volado = true, fecha = hoyISO(), por = '', nota = null } = {}) {
  iniciar();
  const plan = await planDeProyecto(proyectoId);
  const ciclo = plan && (await ciclosDePlan(plan.id))[0];
  if (!ciclo) throw new Error('Este proyecto no tiene un mes de seguimiento abierto.');
  const est = estadoCiclo(await eventosDeCiclo(ciclo.id));
  const cambios = [{ tramoId, tipo: 'terreno', valor: volado ? fecha : '', por }];
  if (nota != null) cambios.push({ tramoId, tipo: 'nota', valor: nota, por });
  const { eventos } = prepararCambios(est, cambios, { cicloId: ciclo.id, planId: plan.id, por });
  if (eventos.length) await agregarEventos(eventos.map(e => ({ ...e, origen: 'app-terreno' })));
  return eventos.length;
}
