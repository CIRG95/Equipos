// modulos/equipos/datos.js — lectura y escritura de los almacenes del módulo.
// USO INTERNO: otros módulos no importan este archivo; usan equipos.js (la puerta de entrada).

import { registrarAlmacenes, obtener, todos, porIndice, guardar, guardarVarios } from '../../compartido/almacen.js';
import { sellar, ahoraISO, hoyISO, fechaLegible, uuid } from '../../compartido/util.js';
import { enviarAPapelera } from '../../compartido/papelera.js';
import { guardarArchivo, archivoAPapelera } from '../../compartido/archivos.js';
import { OFICINA_ID } from '../../compartido/catalogos.js';
import {
  ALM, DEFINICIONES_ALMACENES, SCHEMA_VERSION, nuevoEquipo, calcularUbicacion,
  estadoCalibracion, alertaActiva, nombreCorto, migrarEquipo, claveModelo, vencimientosAdmin,
} from './modelo.js';

let personaActual = null;

export function iniciarDatos({ personaId = null } = {}) {
  registrarAlmacenes(DEFINICIONES_ALMACENES);
  personaActual = personaId;
}
export function fijarPersona(personaId) { personaActual = personaId; }

const sello = r => sellar(r, { personaId: personaActual, schemaVersion: SCHEMA_VERSION });
const vivo = r => !r.eliminadoEn;
const porFecha = (a, b) => (a.fecha || '').localeCompare(b.fecha || '');

function nuevoEvento(datos) {
  return sello({
    equipoId: null, tipo: '', fecha: ahoraISO(),
    proyectoId: null, personaId: null, desdeProyectoId: null,
    checklist: [], faltantes: [], alertasAbiertas: [], avisos: [], nota: '',
    ...datos,
  });
}

// ───────── Equipos ─────────

/** Lee un equipo ya pasado al formato actual. */
async function leerEquipo(id) { return migrarEquipo(await obtener(ALM.equipos, id)); }

export async function listarEquipos({ incluirEliminados = false } = {}) {
  const lista = (await todos(ALM.equipos)).map(migrarEquipo);
  return incluirEliminados ? lista : lista.filter(vivo);
}

export function obtenerEquipoCrudo(id) { return leerEquipo(id); }

/** Crea o actualiza un equipo. Al crearlo registra el evento «alta». */
export async function guardarEquipo(datos) {
  const existente = datos.id ? await leerEquipo(datos.id) : null;
  const eq = sello(existente ? { ...existente, ...datos } : nuevoEquipo(datos));
  if (existente) { await guardar(ALM.equipos, eq); return eq; }
  const ev = nuevoEvento({ equipoId: eq.id, tipo: 'alta', proyectoId: OFICINA_ID, nota: eq.origen === 'planilla' ? 'Importado desde la planilla de RRHH' : '' });
  await guardarVarios([{ almacen: ALM.equipos, registro: eq }, { almacen: ALM.eventos, registro: ev }]);
  return eq;
}

export async function papeleraEquipo(id) {
  return enviarAPapelera(ALM.equipos, id, { personaId: personaActual, schemaVersion: SCHEMA_VERSION });
}

export async function cambiarBaja(equipoId, deBaja, nota = '') {
  const eq = await leerEquipo(equipoId);
  eq.deBaja = deBaja;
  const ev = nuevoEvento({ equipoId, tipo: deBaja ? 'baja' : 'reactivacion', nota });
  await guardarVarios([{ almacen: ALM.equipos, registro: sello(eq) }, { almacen: ALM.eventos, registro: ev }]);
}

export async function registrarCalibracion(equipoId, { fecha, laboratorio = '', certificado = '', nota = '' }) {
  const eq = await leerEquipo(equipoId);
  eq.fechaUltimaCalibracion = fecha;
  eq.calibracionNoAplica = false;
  if (laboratorio) eq.laboratorio = laboratorio;
  if (certificado) eq.certificado = certificado;
  const ev = nuevoEvento({ equipoId, tipo: 'calibracion', nota: [`Calibrado el ${fechaLegible(fecha)}`, laboratorio, nota].filter(Boolean).join(' · ') });
  await guardarVarios([{ almacen: ALM.equipos, registro: sello(eq) }, { almacen: ALM.eventos, registro: ev }]);
}

// ───────── Eventos y alertas ─────────

export async function eventosDeEquipo(equipoId) {
  return (await porIndice(ALM.eventos, 'equipoId', equipoId)).sort(porFecha);
}

export async function alertasDeEquipo(equipoId) {
  return (await porIndice(ALM.alertas, 'equipoId', equipoId)).filter(vivo)
    .sort((a, b) => b.fechaReporte.localeCompare(a.fechaReporte));
}

export async function todasLasAlertas() {
  return (await todos(ALM.alertas)).filter(vivo).sort((a, b) => b.fechaReporte.localeCompare(a.fechaReporte));
}

/** Estado completo de un equipo: ubicación, calibración y alertas activas. */
export function componerEstado(eq, eventosAsc, alertas) {
  return {
    equipo: eq,
    nombre: nombreCorto(eq),
    ubicacion: calcularUbicacion(eq, eventosAsc),
    calibracion: estadoCalibracion(eq),
    vencimientos: vencimientosAdmin(eq),
    alertasActivas: alertas.filter(alertaActiva),
  };
}

export async function estadoDeEquipo(equipoId) {
  const eq = await leerEquipo(equipoId);
  if (!eq || eq.eliminadoEn) return null;
  const [eventos, alertas] = await Promise.all([eventosDeEquipo(equipoId), alertasDeEquipo(equipoId)]);
  return { ...componerEstado(eq, eventos, alertas), eventos, alertas };
}

/** Todos los equipos con su estado, cargando eventos y alertas una sola vez. */
export async function listarConEstado() {
  const [equipos, eventos, alertas] = await Promise.all([listarEquipos(), todos(ALM.eventos), todos(ALM.alertas)]);
  const evPor = {}, alPor = {};
  for (const e of eventos.sort(porFecha)) (evPor[e.equipoId] ||= []).push(e);
  for (const a of alertas.filter(vivo)) (alPor[a.equipoId] ||= []).push(a);
  return equipos.map(eq => componerEstado(eq, evPor[eq.id] || [], alPor[eq.id] || []));
}

/** Avisos que no bloquean: alertas abiertas y calibración vencida o por vencer. */
export function avisosDe(estado) {
  const avisos = [];
  for (const a of estado.alertasActivas) avisos.push(`Alerta activa: ${a.descripcion}`);
  if (estado.calibracion.nivel === 'vencida') avisos.push(`Calibración vencida (${fechaLegible(estado.calibracion.proxima)})`);
  if (estado.calibracion.nivel === 'por_vencer') avisos.push(`Calibración vence el ${fechaLegible(estado.calibracion.proxima)}`);
  for (const v of estado.vencimientos || []) {
    if (v.nivel === 'vencida') avisos.push(`${v.nombre} vencido (${fechaLegible(v.fecha)})`);
    if (v.nivel === 'por_vencer') avisos.push(`${v.nombre} vence el ${fechaLegible(v.fecha)}`);
  }
  return avisos;
}

/**
 * Checklist de salida / traspaso. Cada item: { equipoId, checklist: [{nombre, ok}] }.
 * Si el equipo está en oficina queda como «salida»; si ya estaba en otro proyecto, «traspaso».
 * Nada se bloquea: las alertas y faltantes quedan registrados en el evento.
 */
export async function registrarSalida(items, { proyectoId, personaId, nota = '' }) {
  const ops = [];
  const resultado = [];
  for (const it of items) {
    const est = await estadoDeEquipo(it.equipoId);
    if (!est) continue;
    const tipo = est.ubicacion.lugar === 'terreno' ? 'traspaso' : 'salida';
    const ev = nuevoEvento({
      equipoId: it.equipoId, tipo, proyectoId, personaId,
      desdeProyectoId: est.ubicacion.proyectoId,
      checklist: it.checklist,
      faltantes: it.checklist.filter(c => !c.ok).map(c => c.nombre),
      alertasAbiertas: est.alertasActivas.map(a => a.id),
      avisos: avisosDe(est),
      nota,
    });
    ops.push({ almacen: ALM.eventos, registro: ev });
    resultado.push({ nombre: est.nombre, tipo, faltantes: ev.faltantes, avisos: ev.avisos });
  }
  await guardarVarios(ops);
  return resultado;
}

export async function registrarRegreso(items, { nota = '' } = {}) {
  const ops = [];
  const resultado = [];
  for (const it of items) {
    const est = await estadoDeEquipo(it.equipoId);
    if (!est) continue;
    const ev = nuevoEvento({
      equipoId: it.equipoId, tipo: 'regreso', proyectoId: OFICINA_ID,
      personaId: est.ubicacion.personaId, desdeProyectoId: est.ubicacion.proyectoId,
      checklist: it.checklist,
      faltantes: it.checklist.filter(c => !c.ok).map(c => c.nombre),
      alertasAbiertas: est.alertasActivas.map(a => a.id),
      nota,
    });
    ops.push({ almacen: ALM.eventos, registro: ev });
    // Lo que no volvió queda marcado «Falta» en sus accesorios; lo que volvió y faltaba, vuelve a «Bueno».
    const eq = est.equipo;
    let cambio = false;
    for (const c of it.checklist) {
      const acc = eq.accesorios.find(a => a.nombre === c.nombre);
      if (!acc) continue;
      if (!c.ok && acc.estado !== 'falta') { acc.estado = 'falta'; cambio = true; }
      else if (c.ok && acc.estado === 'falta') { acc.estado = 'bueno'; cambio = true; }
    }
    if (cambio) ops.push({ almacen: ALM.equipos, registro: sello(eq) });
    resultado.push({ nombre: est.nombre, faltantes: ev.faltantes });
  }
  await guardarVarios(ops);
  return resultado;
}

/** Registra que alguien usó el equipo. Si tiene alertas activas, quedan anotadas en el evento. */
export async function registrarUso(equipoId, personaId, proyectoId, nota = '') {
  const est = await estadoDeEquipo(equipoId);
  if (!est) return null;
  const ev = nuevoEvento({
    equipoId, tipo: 'uso', personaId, proyectoId,
    alertasAbiertas: est.alertasActivas.map(a => a.id),
    avisos: avisosDe(est), nota,
  });
  await guardar(ALM.eventos, ev);
  return { evento: ev, alertas: est.alertasActivas };
}

/** Terreno inicia el informe de anomalía. La alerta no bloquea el uso del equipo. */
export async function reportarAnomalia({ equipoId, descripcion, proyectoId = null, personaId = null }) {
  const est = await estadoDeEquipo(equipoId);
  const quien = personaId || personaActual;
  const proyecto = proyectoId || (est && est.ubicacion.proyectoId) || null;
  const ahora = ahoraISO();
  const alerta = sello({
    equipoId, descripcion, estado: 'abierta', reportadaPor: quien, proyectoId: proyecto,
    fechaReporte: ahora,
    historial: [{ estado: 'abierta', fecha: ahora, personaId: quien, nota: descripcion }],
  });
  const ev = nuevoEvento({ equipoId, tipo: 'alerta', alertaId: alerta.id, estadoAlerta: 'abierta', personaId: quien, proyectoId: proyecto, nota: descripcion });
  await guardarVarios([{ almacen: ALM.alertas, registro: alerta }, { almacen: ALM.eventos, registro: ev }]);
  return alerta;
}

/** RRHH avanza la alerta: enviar a mantención, recibir, cerrar. */
export async function cambiarEstadoAlerta(alertaId, estado, nota = '') {
  const a = await obtener(ALM.alertas, alertaId);
  if (!a) return null;
  const ahora = ahoraISO();
  a.estado = estado;
  a.historial = [...(a.historial || []), { estado, fecha: ahora, personaId: personaActual, nota }];
  if (estado === 'cerrada') a.fechaCierre = ahora;
  const ev = nuevoEvento({ equipoId: a.equipoId, tipo: 'alerta', alertaId, estadoAlerta: estado, personaId: personaActual, nota });
  await guardarVarios([{ almacen: ALM.alertas, registro: sello(a) }, { almacen: ALM.eventos, registro: ev }]);
  return a;
}

/** Usos y movimientos registrados mientras una alerta estaba abierta (para trazar responsables). */
export async function usosConAlerta(alertaId, equipoId) {
  return (await eventosDeEquipo(equipoId)).filter(e => (e.alertasAbiertas || []).includes(alertaId));
}

// ───────── Fotos ─────────

const carpetaEquipo = eq => `Equipos/${[eq.marca, eq.modelo, eq.numeroSerie].filter(Boolean).join(' ')}`;

/** Foto del equipo (rol 'foto') o de su placa (rol 'placa'). Reemplaza la anterior (queda en la papelera). */
export async function fijarFoto(equipoId, rol, archivo) {
  const eq = await leerEquipo(equipoId);
  const campo = rol === 'placa' ? 'placaId' : 'fotoId';
  const a = await guardarArchivo(archivo, { modulo: 'equipos', duenoTipo: 'equipo', duenoId: equipoId, rol, carpeta: `${carpetaEquipo(eq)}/Fotos` }, { personaId: personaActual });
  if (eq[campo]) await archivoAPapelera(eq[campo], { personaId: personaActual });
  eq[campo] = a.id;
  await guardar(ALM.equipos, sello(eq));
  return a;
}

// ───────── Accesorios ─────────

export async function guardarAccesorios(equipoId, lista) {
  const eq = await leerEquipo(equipoId);
  eq.accesorios = lista.filter(a => a.nombre && a.nombre.trim()).map(a => ({
    id: a.id && !/^a\d+$/.test(a.id) ? a.id : uuid(),
    nombre: a.nombre.trim(), cantidad: Math.max(1, Number(a.cantidad) || 1),
    serie: (a.serie || '').trim(), estado: a.estado || 'bueno',
  }));
  await guardar(ALM.equipos, sello(eq));
  return eq.accesorios;
}

export async function cambiarEstadoAccesorio(equipoId, accesorioId, estado) {
  const eq = await leerEquipo(equipoId);
  const acc = eq.accesorios.find(a => a.id === accesorioId);
  if (!acc) return;
  acc.estado = estado;
  if (/^a\d+$/.test(acc.id)) eq.accesorios.forEach(a => { if (/^a\d+$/.test(a.id)) a.id = uuid(); }); // fija ids definitivos
  await guardar(ALM.equipos, sello(eq));
}

// ───────── Modelos (especificaciones y documentos compartidos) ─────────

export async function obtenerModelo(eq) {
  const id = claveModelo(eq);
  return id ? (await obtener(ALM.modelos, id)) || null : null;
}

export async function guardarEspecificaciones(eq, specs, otras = '') {
  const id = claveModelo(eq);
  if (!id) throw new Error('El equipo necesita marca o modelo para guardar sus especificaciones.');
  const actual = (await obtener(ALM.modelos, id)) || { id, marca: eq.marca, modelo: eq.modelo, categoria: eq.categoria };
  actual.specs = specs;
  actual.otras = otras;
  return guardar(ALM.modelos, sello(actual));
}

/** Documento del modelo (ficha técnica, manual) o de la unidad. */
export async function subirDocumento(eq, { nivel, rol, archivo }) {
  const deModelo = nivel === 'modelo';
  const duenoId = deModelo ? claveModelo(eq) : eq.id;
  if (!duenoId) throw new Error('El equipo necesita marca o modelo para guardar documentos del modelo.');
  const carpeta = deModelo ? `Equipos/Modelos/${[eq.marca, eq.modelo].filter(Boolean).join(' ')}` : `${carpetaEquipo(eq)}/Documentos`;
  return guardarArchivo(archivo, { modulo: 'equipos', duenoTipo: deModelo ? 'modelo' : 'equipo-doc', duenoId, rol, carpeta }, { personaId: personaActual });
}

// ───────── Certificados ─────────

export async function listarCertificados(equipoId) {
  return (await porIndice(ALM.certificados, 'equipoId', equipoId)).filter(vivo)
    .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || b.creadoEn.localeCompare(a.creadoEn));
}

export async function todosLosCertificados() {
  return (await todos(ALM.certificados)).filter(vivo).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
}

export async function certificadoVigente(equipoId) { return (await listarCertificados(equipoId))[0] || null; }

/**
 * Agrega un certificado (código, fecha de mantención, PDF). Si es el más reciente y el equipo se calibra,
 * actualiza su FECHA CALIBRACIÓN y deja el evento en el historial.
 */
export async function agregarCertificado(equipoId, { codigo, fecha, laboratorio = '', archivo = null, actualizarFecha = true }) {
  const eq = await leerEquipo(equipoId);
  let archivoId = null;
  if (archivo) {
    const a = await guardarArchivo(archivo, { modulo: 'equipos', duenoTipo: 'certificado', duenoId: equipoId, rol: 'certificado', carpeta: `${carpetaEquipo(eq)}/Certificados` }, { personaId: personaActual });
    archivoId = a.id;
  }
  const cert = sello({ equipoId, codigo: codigo.trim(), fecha, laboratorio: laboratorio.trim(), archivoId });
  const ops = [{ almacen: ALM.certificados, registro: cert }];
  if (actualizarFecha && !eq.calibracionNoAplica && (!eq.fechaUltimaCalibracion || fecha >= eq.fechaUltimaCalibracion)) {
    eq.fechaUltimaCalibracion = fecha;
    if (laboratorio) eq.laboratorio = laboratorio;
    ops.push({ almacen: ALM.equipos, registro: sello(eq) });
  }
  ops.push({ almacen: ALM.eventos, registro: nuevoEvento({ equipoId, tipo: 'calibracion', nota: [`Certificado ${cert.codigo} del ${fechaLegible(fecha)}`, laboratorio].filter(Boolean).join(' · ') }) });
  await guardarVarios(ops);
  return cert;
}

export async function adjuntarPdfCertificado(certId, archivo) {
  const c = await obtener(ALM.certificados, certId);
  const eq = await leerEquipo(c.equipoId);
  const a = await guardarArchivo(archivo, { modulo: 'equipos', duenoTipo: 'certificado', duenoId: c.equipoId, rol: 'certificado', carpeta: `${carpetaEquipo(eq)}/Certificados` }, { personaId: personaActual });
  c.archivoId = a.id;
  return guardar(ALM.certificados, sello(c));
}

export async function papeleraCertificado(id) {
  return enviarAPapelera(ALM.certificados, id, { personaId: personaActual, schemaVersion: SCHEMA_VERSION });
}

// ───────── Mantenciones ─────────

export async function listarMantenciones(equipoId) {
  return (await porIndice(ALM.mantenciones, 'equipoId', equipoId)).filter(vivo).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
}

export async function agregarMantencion(equipoId, datos) {
  const m = sello({ equipoId, fecha: datos.fecha, tipo: datos.tipo, proveedor: datos.proveedor || '', orden: datos.orden || '',
    costo: datos.costo ? Number(datos.costo) : null, descripcion: datos.descripcion || '', alertaId: datos.alertaId || null });
  await guardar(ALM.mantenciones, m);
  return m;
}

export async function papeleraMantencion(id) {
  return enviarAPapelera(ALM.mantenciones, id, { personaId: personaActual, schemaVersion: SCHEMA_VERSION });
}

// ───────── Notas de terreno ─────────

export async function listarNotas(equipoId) {
  return (await porIndice(ALM.notas, 'equipoId', equipoId)).filter(vivo).sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
}

export async function agregarNota(equipoId, texto) {
  return guardar(ALM.notas, sello({ equipoId, texto: texto.trim(), archivada: false }));
}

export async function archivarNota(id, archivada = true) {
  const n = await obtener(ALM.notas, id);
  n.archivada = archivada;
  return guardar(ALM.notas, sello(n));
}

// ───────── Datos administrativos ─────────

export async function guardarAdmin(equipoId, admin) {
  const eq = await leerEquipo(equipoId);
  eq.admin = { ...eq.admin, ...admin };
  return guardar(ALM.equipos, sello(eq));
}

export function personaActiva() { return personaActual; }

export { hoyISO };
