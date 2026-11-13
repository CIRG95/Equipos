// modulos/administracion/administracion.js — PUERTA DE ENTRADA del módulo Administración (Administración 0.1, Sistema v0.15).
// Personal para Recursos Humanos (documentos, acreditación, contrato, vacaciones, EPP, CV, licitaciones), vehículos con su
// acreditación por mandante (SUCAL), viajes, fondos, guías de despacho, mandantes, área comercial, conocimiento y seguridad.

import { iniciarDatos, fijarPersona, cargarTodo, VERSION_MODULO, ALM } from './datos.js';
import { pendientesAdmin, eventosAdmin, habilitacionPersona, acreditacion, mandanteDeProyecto } from './modelo.js';
import { leccionesRelacionadas } from './pantallas-conocimiento.js';
import { montarPantallas } from './pantallas.js';

export const VERSION = VERSION_MODULO;
export const ALMACENES = Object.values(ALM);

let iniciado = false;
export function iniciar({ personaId } = {}) {
  if (!iniciado) { iniciarDatos({ personaId: personaId ?? null }); iniciado = true; }
  else if (personaId !== undefined) fijarPersona(personaId);
}

/** contexto: ver pantallas.js (seccion, ruta, rol, personaId, avisar, ir, equipos, gastos, reportarEquipo, textosTipos, marca). */
export function montar(contenedor, contexto) {
  iniciar({ personaId: contexto.personaId });
  return montarPantallas(contenedor, contexto);
}

/** Todo lo de Administración (para Inicio, la ficha del proyecto, el calendario y el buscador). */
export async function datos() { iniciar(); return cargarTodo(); }

/** Pendientes de Administración para «Mis pendientes» según el rol. */
export async function pendientes({ rol, personaId, personas, proyectos, hoy }) {
  iniciar();
  return pendientesAdmin({ rol, personaId, d: await cargarTodo(), personas, proyectos, hoy });
}

/** Eventos para el calendario único (vencimientos, ausencias, fin de contratos). */
export async function eventosCalendario({ desde, hasta, rol, personas }) {
  iniciar();
  return eventosAdmin({ d: await cargarTodo(), personas, desde, hasta, rol });
}

/** Cuadrilla y vehículos de un proyecto con su habilitación (sin detalle de documentos: lo puede ver el encargado). */
export async function cuadrillaDeProyecto(p, { personas, hoy }) {
  iniciar();
  const d = await cargarTodo();
  const base = { ...d, hoy, diasAviso: d.config.diasAviso };
  const man = mandanteDeProyecto(p, d.mandantes);
  const gente = (p.cuadrilla || []).map(id => personas.find(x => x.id === id)).filter(Boolean).map(per => {
    const h = man && (man.requisitosPersona || []).length ? acreditacion(man, 'persona', per.id, base) : habilitacionPersona(per.id, base);
    const fi = d.fichas.find(x => x.id === per.id) || {};
    return { persona: per, h, emergencia: fi.emergencia || null, ausente: d.ausencias.some(a => a.personaId === per.id && a.estado === 'aprobada' && a.desde <= hoy && hoy <= (a.hasta || a.desde)) };
  });
  const vehiculos = (p.vehiculoIds || []).map(id => d.vehiculos.find(x => x.id === id)).filter(Boolean).map(v => ({ vehiculo: v, h: man && (man.requisitosVehiculo || []).length ? acreditacion(man, 'vehiculo', v.id, base) : null }));
  const seguridad = d.seguridad.filter(x => x.proyectoId === p.id);
  return { mandante: man, gente, vehiculos, seguridad, d };
}

export { leccionesRelacionadas, mandanteDeProyecto };
