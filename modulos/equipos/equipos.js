// modulos/equipos/equipos.js — PUERTA DE ENTRADA del módulo de Equipos.
// Es lo único que otros módulos (Terreno Topografía, Gastos) y la app global deben importar.
// Nadie lee los almacenes equipos_… directamente.

import {
  iniciarDatos, fijarPersona, estadoDeEquipo, listarConEstado, registrarUso, listarCertificados,
} from './datos.js';
import { abrirArchivo } from '../../compartido/archivos.js';
import { VERSION_MODULO, ALM } from './modelo.js';
import { montarPantallas } from './pantallas.js';

export const VERSION = VERSION_MODULO;
export const ALMACENES = Object.values(ALM);

let iniciado = false;

/** Registra los almacenes del módulo. La app global lo llama una vez al arrancar. */
export function iniciar({ personaId } = {}) {
  if (!iniciado) { iniciarDatos({ personaId: personaId ?? null }); iniciado = true; }
  else if (personaId !== undefined) fijarPersona(personaId);
}

/**
 * Monta las pantallas del módulo dentro de `contenedor`.
 * contexto: { rol: 'terreno' | 'rrhh', personaId, equipoInicial?, enlaceEquipo? }
 * Devuelve { desmontar(), refrescar() } — refrescar() se llama cuando llegan datos de la nube.
 */
export function montar(contenedor, contexto) {
  iniciar({ personaId: contexto.personaId });
  return montarPantallas(contenedor, contexto);
}

function resumen(est) {
  if (!est) return null;
  return {
    id: est.equipo.id,
    nombre: est.nombre,
    equipo: est.equipo.equipo,
    marca: est.equipo.marca,
    modelo: est.equipo.modelo,
    descripcion: est.equipo.descripcion,
    numeroSerie: est.equipo.numeroSerie,
    categoria: est.equipo.categoria,
    componentes: est.equipo.accesorios.map(a => a.nombre),   // nombres (compatibilidad con v0.1)
    accesorios: est.equipo.accesorios.map(a => ({ ...a })),   // [{ id, nombre, cantidad, serie, estado }]
    fechaUltimaCalibracion: est.equipo.fechaUltimaCalibracion,
    calibracion: { ...est.calibracion },              // { nivel: ok|por_vencer|vencida|sin_dato|no_aplica, proxima, dias }
    ubicacion: { ...est.ubicacion },                  // { lugar: oficina|terreno|mantencion|baja, proyectoId, personaId, desde }
    alertasActivas: est.alertasActivas.map(a => ({ id: a.id, estado: a.estado, descripcion: a.descripcion, fechaReporte: a.fechaReporte })),
  };
}

/** Datos de un equipo y su estado actual (o null si no existe o está en la papelera). */
export async function obtenerEquipo(equipoId) {
  iniciar();
  return resumen(await estadoDeEquipo(equipoId));
}

/** Equipos que están hoy asignados a un proyecto (según el último checklist de salida o traspaso). */
export async function equiposDeProyecto(proyectoId) {
  iniciar();
  return (await listarConEstado())
    .filter(e => e.ubicacion.proyectoId === proyectoId && e.ubicacion.lugar !== 'baja')
    .map(resumen);
}

/** Alertas no cerradas de un equipo. */
export async function alertasActivas(equipoId) {
  iniciar();
  const est = await estadoDeEquipo(equipoId);
  return est ? resumen(est).alertasActivas : [];
}

/**
 * Registra que una persona usó el equipo en un proyecto. Nunca bloquea:
 * si hay alertas activas, quedan anotadas en el registro y se devuelven para mostrar el aviso.
 * Devuelve { registrado: true, alertas: [...] }.
 */
export async function registrarUsoConAlerta(equipoId, personaId, proyectoId) {
  iniciar();
  const r = await registrarUso(equipoId, personaId, proyectoId);
  if (!r) return { registrado: false, alertas: [] };
  return {
    registrado: true,
    eventoId: r.evento.id,
    alertas: r.alertas.map(a => ({ id: a.id, estado: a.estado, descripcion: a.descripcion })),
  };
}

/** Certificado más reciente del equipo: { id, codigo, fecha, laboratorio, archivoId } o null. */
export async function certificadoVigente(equipoId) {
  iniciar();
  const c = (await listarCertificados(equipoId))[0];
  return c ? { id: c.id, codigo: c.codigo, fecha: c.fecha, laboratorio: c.laboratorio, archivoId: c.archivoId } : null;
}

/** Equipos asignados hoy a un proyecto, cada uno con su certificado vigente (para presentar al mandante). */
export async function certificadosDeProyecto(proyectoId) {
  const eqs = await equiposDeProyecto(proyectoId);
  return Promise.all(eqs.map(async e => ({ equipo: e, certificado: await certificadoVigente(e.id) })));
}

/** Abre un archivo del módulo (por ejemplo el PDF de un certificado) en otra pestaña. */
export { abrirArchivo };
