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
import * as Gastos from '../modulos/gastos/datos.js';
import { CATEGORIAS, problemasGasto, posiblesDuplicados, libroCuenta, eventosDe, estadoRendicion, ultimo, numeroSiguiente, gastoEditable, ordenGastos, suma } from '../modulos/gastos/modelo.js';
import { urlArchivo, infoArchivo } from '../compartido/archivos.js';

// v1.4 (Sistema v0.14): gastos desde Terreno — misma lógica y almacenes que el módulo Gastos 0.1 del Sistema.
export const VERSION = '1.4 (Sistema v0.14)';
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
  Gastos.iniciarDatos({ personaId: p ? p.id : null });
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
  Gastos.fijarPersona(p.id);
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

// ───────── Gastos (v1.4) ─────────
// Terreno solo AGREGA y corrige los gastos de su propia persona (borrador o rendición devuelta).
// Enviar la rendición, depósitos y pagos se hacen en el Sistema. La foto de la boleta es obligatoria en Terreno.
export const CATEGORIAS_GASTO = CATEGORIAS;

const nombreProyecto = async id => id === OFICINA_ID ? 'Oficina' : ((await obtenerProyecto(id)) || {}).nombre || 'Proyecto';
const aArchivo = async a => {
  if (!a) return null;
  if (typeof a !== 'string') return a; // File o Blob
  const blob = await (await fetch(a)).blob(); // dataURL
  return new File([blob], `boleta.${(blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')}`, { type: blob.type });
};
const resumenGasto = g => ({ id: g.id, fecha: g.fecha, monto: g.monto, categoria: g.categoria, comercio: g.comercio || '', nota: g.nota || '',
  proyectoId: g.proyectoId, rendicionId: g.rendicionId || null, archivoId: g.archivoId || null, sinBoleta: !!g.sinBoleta, motivoSinBoleta: g.motivoSinBoleta || '', creadoEn: g.creadoEn });

/** Proyectos donde se puede cargar un gasto: los activos (primero los propios) y al final «Oficina». [{ id, nombre, mio }] */
export async function proyectosGastos() {
  const p = yo();
  const lista = (await listarProyectos()).filter(x => x.id !== OFICINA_ID && x.estado !== 'cerrado')
    .map(x => ({ id: x.id, nombre: x.nombre, mio: x.encargadoId === p.id }))
    .sort((a, b) => (b.mio - a.mio) || a.nombre.localeCompare(b.nombre, 'es'));
  return [...lista, { id: OFICINA_ID, nombre: 'Oficina', mio: false }];
}

/**
 * Todo lo de gastos de la persona para la pantalla de Terreno.
 * proyectoId: la cuenta (persona × proyecto) que se muestra.
 * Devuelve { proyectoId, numeroSiguiente, borrador: { gastos, fondo, gastado, saldo, anterior, depositos },
 *   devueltas: [{ id, numero, motivo, observados, gastos }], rendiciones: [{ id, numero, proyectoId, proyecto, estado, total, n, fecha, motivo, pagado }] }
 */
export async function misGastos(proyectoId) {
  const p = yo();
  const d = await Gastos.cargarTodo();
  const lb = libroCuenta({ ...d, personaId: p.id, proyectoId });
  const b = lb.borrador;
  const nombres = new Map();
  const nom = async id => { if (!nombres.has(id)) nombres.set(id, await nombreProyecto(id)); return nombres.get(id); };
  const mias = d.rendiciones.filter(r => r.personaId === p.id).sort((a, c) => (c.numero || 0) - (a.numero || 0));
  const rendiciones = [];
  for (const r of mias) {
    const ev = eventosDe(d.eventos, r.id), est = estadoRendicion(ev), gs = d.gastos.filter(g => g.rendicionId === r.id);
    const env = ev.find(e => e.tipo === 'enviada'), dev = ultimo(ev, 'devuelta'), pag = ultimo(ev, 'pagada');
    rendiciones.push({ id: r.id, numero: r.numero, proyectoId: r.proyectoId, proyecto: await nom(r.proyectoId), estado: est, total: suma(gs), n: gs.length,
      fecha: env ? env.fecha : null, motivo: est === 'devuelta' && dev ? dev.motivo : '', observados: est === 'devuelta' && dev ? dev.observados || [] : [],
      pagado: est === 'pagada' && pag ? { fecha: pag.fecha, monto: pag.monto || 0, reintegro: pag.reintegro || 0 } : null });
  }
  const devueltas = rendiciones.filter(r => r.estado === 'devuelta' && r.proyectoId === proyectoId)
    .map(r => ({ ...r, gastos: d.gastos.filter(g => g.rendicionId === r.id).sort(ordenGastos).map(resumenGasto) }));
  return {
    proyectoId, numeroSiguiente: numeroSiguiente(d.rendiciones, p.id),
    borrador: { gastos: [...b.gastos].sort(ordenGastos).reverse().map(resumenGasto), fondo: b.fondo, gastado: b.gastado, saldo: b.saldo, anterior: b.anterior, depositos: b.depositos },
    devueltas, rendiciones,
  };
}

/** Rendiciones devueltas de la persona (todas las cuentas), para el aviso en Terreno. */
export async function gastosDevueltos() {
  const p = persona();
  if (!p) return [];
  const d = await Gastos.cargarTodo();
  return d.rendiciones.filter(r => r.personaId === p.id && estadoRendicion(eventosDe(d.eventos, r.id)) === 'devuelta')
    .map(r => ({ id: r.id, numero: r.numero, proyectoId: r.proyectoId, motivo: (ultimo(eventosDe(d.eventos, r.id), 'devuelta') || {}).motivo || '' }));
}

/**
 * Guarda un gasto nuevo o corrige uno propio. datos: { id?, monto, categoria, fecha, proyectoId, comercio?, nota? }.
 * archivo: File, Blob o dataURL de la boleta (obligatoria si el gasto no tiene una).
 * Si hay un posible duplicado (misma persona, fecha y monto) y no viene confirmarDuplicado, devuelve { duplicados } sin guardar.
 * Devuelve { gasto } al guardar. Sin señal queda guardado y sube con la próxima sincronización.
 */
export async function guardarGasto(datos, { archivo = null, confirmarDuplicado = false } = {}) {
  const p = yo();
  const d = await Gastos.cargarTodo();
  const previo = datos.id ? d.gastos.find(g => g.id === datos.id) : null;
  if (datos.id && !previo) throw new Error('Ese gasto ya no existe.');
  if (previo) {
    if (previo.personaId !== p.id) throw new Error('Ese gasto es de otra persona.');
    const est = previo.rendicionId ? estadoRendicion(eventosDe(d.eventos, previo.rendicionId)) : 'borrador';
    if (!gastoEditable(previo, est)) throw new Error('Ese gasto ya está en una rendición enviada: no se puede cambiar.');
  }
  const g = {
    ...(previo || { personaId: p.id, rendicionId: null }),
    monto: Math.round(Number(datos.monto) || 0), categoria: datos.categoria || '', fecha: datos.fecha || '',
    proyectoId: previo && previo.rendicionId ? previo.proyectoId : (datos.proyectoId || ''),
    comercio: String(datos.comercio || '').trim(), nota: String(datos.nota || '').trim(),
    sinBoleta: false, motivoSinBoleta: '', tieneBoletaNueva: !!archivo,
  };
  const probs = problemasGasto(g).map(t => t.startsWith('Agrega la foto') ? 'Agrega la foto de la boleta o del comprobante.' : t);
  if (probs.length) throw new Error(probs.join(' '));
  if (!confirmarDuplicado) {
    const dups = posiblesDuplicados(g, d.gastos);
    if (dups.length) return { duplicados: dups.map(resumenGasto) };
  }
  Gastos.fijarPersona(p.id);
  const carpeta = `Gastos/${await nombreProyecto(g.proyectoId)}/${p.nombre}`;
  const guardado = await Gastos.guardarGasto(g, { archivo: await aArchivo(archivo), carpeta });
  return { gasto: resumenGasto(guardado || g) };
}

/** Manda un gasto propio (del borrador o de una rendición devuelta) a la papelera. Se puede deshacer con restaurarGasto. */
export async function eliminarGasto(id) {
  const p = yo();
  const d = await Gastos.cargarTodo();
  const g = d.gastos.find(x => x.id === id);
  if (!g) return;
  if (g.personaId !== p.id) throw new Error('Ese gasto es de otra persona.');
  const est = g.rendicionId ? estadoRendicion(eventosDe(d.eventos, g.rendicionId)) : 'borrador';
  if (!gastoEditable(g, est)) throw new Error('Ese gasto ya está en una rendición enviada: no se puede borrar.');
  Gastos.fijarPersona(p.id);
  await Gastos.gastoAPapelera(id);
}
export async function restaurarGasto(id) { yo(); return Gastos.restaurarGasto(id); }

/** Boleta para mostrarla: { url, mime, nombre } (la baja de la nube si en este teléfono solo está la referencia), o null. */
export async function boleta(archivoId) {
  if (!archivoId) return null;
  const info = await infoArchivo(archivoId);
  const url = await urlArchivo(archivoId).catch(() => null);
  return url ? { url, mime: info ? info.mime : '', nombre: info ? info.nombre : 'boleta' } : null;
}

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
