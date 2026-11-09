// modulos/gastos/gastos.js — PUERTA DE ENTRADA del módulo Gastos (Gastos 0.1, Sistema v0.13).
// Gasto con la foto de su boleta dentro de su proyecto (u «Oficina»), rendición por persona y proyecto con
// fondo por rendir, y RRHH que devuelve con motivo o registra el pago. Salidas Excel y PDF con boletas.
// Fuera de la 0.1: OCR, Gmail, cartola y otras monedas (siguen en la app personal Rendición Terreno).

import { iniciarDatos, fijarPersona, cargarTodo, VERSION_MODULO, ALM } from './datos.js';
import { resumenProyecto, avisosGastos } from './modelo.js';
import { montarPantallas } from './pantallas.js';

export const VERSION = VERSION_MODULO;
export const ALMACENES = Object.values(ALM);

let iniciado = false;
export function iniciar({ personaId } = {}) {
  if (!iniciado) { iniciarDatos({ personaId: personaId ?? null }); iniciado = true; }
  else if (personaId !== undefined) fijarPersona(personaId);
}

/**
 * contexto: { rol, personaId, vista?, id? } → { desmontar(), refrescar() }
 *   vista: null (inicio) | 'proyecto' (id = proyectoId) | 'nuevo' (id = proyectoId opcional) | 'gasto' (id = gastoId) | 'rendicion' (id)
 */
export function montar(contenedor, contexto) {
  iniciar({ personaId: contexto.personaId });
  return montarPantallas(contenedor, contexto);
}

/** Resumen para la tarjeta «Gastos del proyecto» de la ficha. */
export async function resumenDeProyecto(proyectoId) {
  iniciar();
  return resumenProyecto({ proyectoId, ...(await cargarTodo()) });
}

/** Avisos para la campanita: [{ id, tipo, rendicion, evento }] (terreno: devueltas y pagadas; RRHH: por revisar). */
export async function avisos({ rol, personaId }) {
  iniciar();
  if (rol !== 'rrhh' && !personaId) return [];
  const { rendiciones, eventos } = await cargarTodo();
  return avisosGastos({ rol, personaId, rendiciones, eventos });
}
