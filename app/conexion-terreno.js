// app/conexion-terreno.js — PAQUETE DE CONEXIÓN para la app de Terreno (se arma como paquete-conexion/topoland-conexion.js,
// script clásico con el global window.TopolandConexion).
//
// La app de Terreno sigue siendo su propia app (decisión del 2-nov). Con este paquete:
//   · se vincula a una persona del Sistema (QR o código), sin usuarios ni contraseñas por ahora;
//   · lee sus proyectos (donde es encargado) y sus equipos en terreno;
//   · reporta un problema o aviso de un equipo (lo ven el encargado del proyecto y Administración en el Sistema);
//   · marca tramos volados del Seguimiento;
//   · publica jornadas, fotos y monografías por proyecto, y lee el estado de revisión de las monografías (v1.2);
//   · sincroniza con la misma nube del Sistema (Google Drive en pruebas).
// v1.3: crea la base «topoland» completa (esquema común, ver compartido/esquema.js) para no bloquear al Sistema;
//       el código del QR queda guardado y se vincula solo cuando llegan las personas desde la nube.
// Usa la base común «topoland» y el mismo formato que el Sistema: no hay que programar nada de eso en Terreno.

import * as nube from '../compartido/nube.js';
import { listarPersonas, listarProyectos, OFICINA_ID } from '../compartido/catalogos.js';
import * as Equipos from '../modulos/equipos/equipos.js';
import * as Seguimiento from '../modulos/seguimiento/seguimiento.js';
import * as Mono from '../modulos/monografias/datos.js'; // solo datos: el paquete no lleva pantallas ni PDF
import { obtenerProyecto } from '../compartido/catalogos.js';

export const VERSION = '1.3 (Sistema v0.8.2)';
const CLAVE_PERSONA = 'topoland_conexion_persona';
const CLAVE_CARPETA = 'topoland_conexion_carpeta';
const CLAVE_CODIGO = 'topoland_conexion_codigo'; // código del QR pendiente (sobrevive a recargas y a pasar a la app instalada)
const leer = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const escribir = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

let codigoPendiente = null;
const fijarCodigo = c => { codigoPendiente = c || null; escribir(CLAVE_CODIGO, codigoPendiente); };
const oyentesDatos = new Set();
const oyentesVinculo = new Set();
let escuchando = false;

// Si hay un código pendiente y ya llegaron las personas, vincula. Devuelve la persona o null.
async function intentarCodigoPendiente() {
  if (!codigoPendiente || persona()) return null;
  try {
    const p = await vincular(codigoPendiente);
    if (p) for (const fn of oyentesVinculo) { try { fn(p); } catch (e) { console.warn(e); } }
    return p;
  } catch (e) { console.warn(e); return null; }
}

/**
 * Llamar una vez al abrir la app. clienteId: el «ID de cliente» de Google (el mismo del Sistema).
 * Lee de la dirección ?carpeta=… y #vincular=… (los pone el QR). Devuelve { persona, codigoPendiente, carpetaPendiente }.
 */
export function iniciar({ clienteId } = {}) {
  const p = persona();
  Equipos.iniciar({ personaId: p ? p.id : null });
  Seguimiento.iniciar({ personaId: p ? p.id : null });
  Mono.iniciarDatos({ personaId: p ? p.id : null });
  nube.configurar({ clienteId: clienteId || undefined });
  nube.iniciar();
  codigoPendiente = leer(CLAVE_CODIGO);
  if (!escuchando) {
    escuchando = true;
    // Primero se intenta el código pendiente y después se avisa a la app, así ya ve a la persona vinculada.
    nube.alDatosRemotos(async (...a) => {
      await intentarCodigoPendiente();
      for (const fn of oyentesDatos) { try { await fn(...a); } catch (e) { console.warn(e); } }
    });
  }
  try {
    const u = new URL(location.href);
    const carpeta = u.searchParams.get('carpeta');
    if (carpeta) { escribir(CLAVE_CARPETA, carpeta); u.searchParams.delete('carpeta'); }
    const m = /vincular=([A-Za-z0-9]{4,12})/.exec(u.hash);
    if (m) { fijarCodigo(m[1].toUpperCase()); u.hash = u.hash.replace(/&?vincular=[A-Za-z0-9]+/, '').replace(/^#$/, ''); }
    if (carpeta || m) history.replaceState(null, '', u.pathname + u.search + u.hash);
  } catch { /* sin URL */ }
  if (p && codigoPendiente) fijarCodigo(null);
  else if (codigoPendiente) intentarCodigoPendiente(); // si las personas ya estaban en el teléfono
  return { persona: p, codigoPendiente, carpetaPendiente: leer(CLAVE_CARPETA) && !nube.estado().carpetaId ? leer(CLAVE_CARPETA) : null };
}

// ───────── Persona vinculada ─────────
/** { id, nombre, cargo } de la persona vinculada en este teléfono, o null. */
export function persona() { return leer(CLAVE_PERSONA); }

/**
 * Vincula este teléfono a la persona que tiene ese código (Sistema → Personas → Vincular teléfono).
 * Devuelve la persona, o null si el código no está entre los datos de este teléfono
 * (en un teléfono nuevo primero hay que conectar la nube para traer las personas).
 */
export async function vincular(codigo) {
  const c = String(codigo || '').trim().toUpperCase();
  if (!c) return null;
  const p = (await listarPersonas()).find(x => String(x.codigoVinculo || '').toUpperCase() === c);
  if (!p) return null;
  const datos = { id: p.id, nombre: p.nombre, cargo: p.cargo || '' };
  escribir(CLAVE_PERSONA, datos);
  Equipos.iniciar({ personaId: p.id });
  Seguimiento.iniciar({ personaId: p.id });
  Mono.iniciarDatos({ personaId: p.id });
  fijarCodigo(null);
  return datos;
}
export function desvincular() { escribir(CLAVE_PERSONA, null); fijarCodigo(null); }

/** Avisa cuando el teléfono queda vinculado solo (código del QR + personas recién llegadas de la nube). */
export const alVincular = fn => { oyentesVinculo.add(fn); return () => oyentesVinculo.delete(fn); };

/**
 * Texto para la persona cuando no se pudo vincular: distingue «faltan los datos de la nube» de «código no encontrado».
 * Devuelve '' si el teléfono ya está vinculado.
 */
export async function explicarVinculo(codigo = codigoPendiente) {
  if (persona()) return '';
  let n = 0;
  try { n = (await listarPersonas()).length; } catch { /* sin base */ }
  const c = String(codigo || '').trim().toUpperCase();
  if (!n) return nube.estado().conectado
    ? 'Todavía no llegan las personas del Sistema. Espera a que termine la sincronización; el teléfono se vincula solo.'
    : 'Conecta la nube del Sistema (Google) para terminar de vincular: las personas vienen desde ahí.';
  if (!c) return 'Escribe el código de 6 letras que muestra el Sistema en Personas → Vincular teléfono.';
  return `El código ${c} no está entre las personas del Sistema. Revisa que sea el vigente (Personas → Vincular teléfono) y sincroniza de nuevo.`;
}

// ───────── Lo de la persona ─────────
const yo = () => { const p = persona(); if (!p) throw new Error('Primero vincula el teléfono a una persona.'); return p; };

/** Proyectos activos donde la persona es encargada: [{ id, nombre, mandante, comuna, region, tiposTrabajo }] */
export async function misProyectos() {
  const p = yo();
  return (await listarProyectos()).filter(x => x.id !== OFICINA_ID && x.estado !== 'cerrado' && x.encargadoId === p.id)
    .map(x => ({ id: x.id, nombre: x.nombre, mandante: x.mandante || '', comuna: x.comuna || '', region: x.region || '', tiposTrabajo: x.tiposTrabajo || [] }));
}

/** Equipos que están en terreno a cargo de la persona o en sus proyectos (según el checklist de salida de Equipos). */
export async function misEquiposEnTerreno() {
  const p = yo();
  const mios = new Set((await misProyectos()).map(x => x.id));
  return (await Equipos.listarEquiposConEstado())
    .filter(e => e.ubicacion.lugar === 'terreno' && (e.ubicacion.personaId === p.id || mios.has(e.ubicacion.proyectoId)))
    .map(e => ({ id: e.id, nombre: e.nombre, numeroSerie: e.numeroSerie || '', proyectoId: e.ubicacion.proyectoId, calibracion: e.calibracion, alertasActivas: e.alertasActivas }));
}

/**
 * Problema o aviso de un equipo en terreno. tipo: 'problema' | 'aviso'.
 * Queda como alerta del equipo: la ven Administración (Equipos → Alertas) y el encargado del proyecto (campanita de avisos).
 * Viaja en la próxima sincronización; sin señal queda guardado en el teléfono y sale después.
 */
export async function reportar({ equipoId, tipo = 'problema', descripcion }) {
  const p = yo();
  if (!equipoId) throw new Error('Elige el equipo.');
  if (!String(descripcion || '').trim()) throw new Error('Escribe qué pasa.');
  const eq = (await Equipos.listarEquiposConEstado()).find(e => e.id === equipoId);
  return Equipos.reportarProblema({ equipoId, tipo, descripcion: String(descripcion).trim(), personaId: p.id, proyectoId: eq ? eq.ubicacion.proyectoId : null });
}

/** Tramos del mes actual de un proyecto (Seguimiento), o null si el proyecto no tiene seguimiento. Cada tramo trae ini/fin (km) si su nombre tiene DM. */
export function tramosDeProyecto(proyectoId) { return Seguimiento.tramosDeProyecto(proyectoId); }

/** Marca un tramo volado hoy (o la fecha dada), con nota opcional. volado: false lo desmarca. */
export function marcarTramoVolado(proyectoId, tramoId, { volado = true, fecha, nota = null } = {}) {
  const p = yo();
  return Seguimiento.marcarTramoVolado(proyectoId, tramoId, { volado, ...(fecha ? { fecha } : {}), por: p.nombre, nota });
}

// ───────── Monografías, jornadas y fotos (v1.2) ─────────
async function opcionesProyecto(proyectoId) {
  const p = yo();
  if (!proyectoId) throw new Error('Elige el proyecto del Sistema.');
  const proy = await obtenerProyecto(proyectoId);
  if (!proy) throw new Error('Ese proyecto no está en este teléfono. Sincroniza con la nube del Sistema.');
  return { proyectoId, personaId: p.id, nombreProyecto: proy.nombre };
}

/**
 * Publica (o vuelve a publicar) una monografía de Terreno tal como la guarda Terreno.
 * Las imágenes dataURL (croquisImg, panoramicaImg, clienteLogo, fotosExtra[].img) pasan a archivos del proyecto en la nube del Sistema.
 * Devuelve { id, estado }. Sin señal queda guardado y sale con la próxima sincronización.
 */
export async function publicarMonografia(m, { proyectoId } = {}) {
  return Mono.publicarMonografia(m, await opcionesProyecto(proyectoId));
}

/** Publica una jornada con sus levantamientos; las fotos de los puntos (y fotosReq) pasan a archivos. Devuelve { id, fotos }. */
export async function publicarJornada(jornada, levantamientos, { proyectoId } = {}) {
  return Mono.publicarJornada(jornada, levantamientos, await opcionesProyecto(proyectoId));
}

/**
 * Sube una foto suelta al proyecto. tipo: 'panoramica' | 'croquis' | 'placa' | 'detalle' | 'punto' | 'otra'.
 * Devuelve { archivoId }. Si la misma foto ya estaba, devuelve la existente.
 */
export async function subirFoto(dataUrl, { proyectoId, tipo = 'otra', monografiaId = null, puntoId = null, punto = '', lat = null, lng = null, hora = null, leyenda = '' } = {}) {
  const op = await opcionesProyecto(proyectoId);
  const archivoId = await Mono.guardarFoto(dataUrl, { ...op, duenoTipo: monografiaId ? 'terreno_monografia' : 'terreno_foto', duenoId: monografiaId, detalle: { tipo, monografiaId, puntoId, punto, lat, lng, hora: hora || new Date().toISOString(), leyenda, autor: persona().nombre } });
  return { archivoId };
}

/** Estado de revisión de las monografías del proyecto: [{ id, punto, estado, observacion, revisadoPor, fecha }]. estado: enviada | en-revision | lista | con-observacion */
export async function estadoMonografias(proyectoId) { yo(); return Mono.estadoMonografias(proyectoId); }

// ───────── Nube ─────────
/** Conecta con Google (llamar desde un toque) y usa la carpeta que trajo el QR. Después intenta el código pendiente. */
export async function conectarNube() {
  await nube.conectar();
  const carpeta = leer(CLAVE_CARPETA);
  if (carpeta && !nube.estado().carpetaId) await nube.usarCarpeta(carpeta);
  else await nube.sincronizar();
  await intentarCodigoPendiente();
  return nube.estado();
}
export const estadoNube = () => nube.estado();
export const alCambiarNube = fn => nube.alEstado(fn);
export const alLlegarDatos = fn => { oyentesDatos.add(fn); return () => oyentesDatos.delete(fn); };
export const sincronizar = () => nube.sincronizar();
export const codigoQR = () => codigoPendiente;
