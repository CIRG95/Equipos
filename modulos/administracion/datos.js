// modulos/administracion/datos.js — almacenes de Administración (Sistema v0.15). Prefijo admin_, se sincronizan con la nube.
//   compartido_mandantes   mandantes con su plataforma de acreditación (p. ej. SUCAL) y requisitos de personas y vehículos
//   admin_tipos_doc        catálogo editable de documentos: aplica a 'persona' o 'vehiculo', si vence y si es obligatorio
//   admin_documentos       un documento cargado (persona o vehículo) con fechas, archivo y estado en cada mandante   índice dueno
//   admin_fichas           datos de RRHH por persona (id = personaId): contrato, turno, vacaciones, EPP, tallas, emergencia
//   admin_ausencias        vacaciones y permisos                                                                        índice personaId
//   admin_licitaciones     paquetes de documentación para licitaciones
//   admin_vehiculos        flota (patente, modelo, kilometraje, proyecto asignado)
//   admin_viajes           traslados y alojamiento por proyecto                                                       índice proyectoId
//   admin_guias            guías de despacho de equipos                                                               índice proyectoId
//   admin_cotizaciones     cotizaciones y licitaciones comerciales
//   admin_seguridad        charlas, riesgos del día e incidencias de terreno                                          índice proyectoId
//   admin_biblioteca       plantillas oficiales, normas, manuales y procedimientos
//   admin_config           configuración común (tabla de tiempos GNSS, tarifas, plazos de aviso)
// Los archivos (PDF, fotos) van en compartido_archivos con modulo 'administracion'.

import { registrarAlmacenes, obtener, todos, guardar, porIndice } from '../../compartido/almacen.js';
import { sellar } from '../../compartido/util.js';
import { enviarAPapelera, restaurar } from '../../compartido/papelera.js';
import { guardarArchivo, archivoAPapelera } from '../../compartido/archivos.js';
import { TIPOS_BASE, MANDANTES_BASE, CONFIG_BASE } from './modelo.js';

export const VERSION_MODULO = '0.1';
export const SCHEMA_VERSION = 1;
export const ALM = {
  mandantes: 'compartido_mandantes', tipos: 'admin_tipos_doc', documentos: 'admin_documentos', fichas: 'admin_fichas',
  ausencias: 'admin_ausencias', licitaciones: 'admin_licitaciones', vehiculos: 'admin_vehiculos', viajes: 'admin_viajes',
  guias: 'admin_guias', cotizaciones: 'admin_cotizaciones', seguridad: 'admin_seguridad', biblioteca: 'admin_biblioteca', config: 'admin_config',
};
export const DEFINICIONES = [
  { nombre: ALM.mandantes }, { nombre: ALM.tipos },
  { nombre: ALM.documentos, indices: [['dueno', ['duenoTipo', 'duenoId']]] },
  { nombre: ALM.fichas }, { nombre: ALM.ausencias, indices: [['personaId', 'personaId']] }, { nombre: ALM.licitaciones },
  { nombre: ALM.vehiculos }, { nombre: ALM.viajes, indices: [['proyectoId', 'proyectoId']] },
  { nombre: ALM.guias, indices: [['proyectoId', 'proyectoId']] }, { nombre: ALM.cotizaciones },
  { nombre: ALM.seguridad, indices: [['proyectoId', 'proyectoId']] }, { nombre: ALM.biblioteca }, { nombre: ALM.config },
];

let persona = null;
export function iniciarDatos({ personaId = null } = {}) { registrarAlmacenes(DEFINICIONES); persona = personaId; }
export function fijarPersona(p) { persona = p; }
export const personaActual = () => persona;
const sello = r => sellar(r, { personaId: persona, schemaVersion: SCHEMA_VERSION });
const vivo = r => r && !r.eliminadoEn;

// ───────── Lectura en bloque (volúmenes chicos) ─────────
export async function listar(almacen) { return (await todos(almacen)).filter(vivo); }
export async function uno(almacen, id) { const r = id ? await obtener(almacen, id) : null; return vivo(r) ? r : null; }

let semillaLista = null;
/** Crea una sola vez los tipos de documento y el mandante Codelco (SUCAL) de base, con ids fijos (dos equipos no los duplican). */
export function asegurarBase() {
  if (semillaLista) return semillaLista;
  semillaLista = (async () => {
    const marca = await obtener(ALM.config, 'semilla');
    if (marca) return;
    const ops = [];
    for (const t of TIPOS_BASE) if (!(await obtener(ALM.tipos, t.id))) ops.push(guardar(ALM.tipos, sello({ ...t })));
    for (const m of MANDANTES_BASE) if (!(await obtener(ALM.mandantes, m.id))) ops.push(guardar(ALM.mandantes, sello({ ...m })));
    if (!(await obtener(ALM.config, 'general'))) ops.push(guardar(ALM.config, sello({ ...CONFIG_BASE, id: 'general' })));
    await Promise.all(ops);
    await guardar(ALM.config, sello({ id: 'semilla', hecho: true }));
  })().catch(e => { semillaLista = null; throw e; });
  return semillaLista;
}

/** Todo lo de Administración de una vez: { mandantes, tipos, documentos, fichas, ausencias, ... , config }. */
export async function cargarTodo() {
  await asegurarBase();
  const claves = Object.keys(ALM).filter(k => k !== 'config');
  const listas = await Promise.all(claves.map(k => listar(ALM[k])));
  const out = Object.fromEntries(claves.map((k, i) => [k, listas[i]]));
  out.config = { ...CONFIG_BASE, ...((await obtener(ALM.config, 'general')) || {}) };
  return out;
}

export async function guardarRegistro(almacen, datos) {
  const previo = datos.id ? await obtener(almacen, datos.id) : null;
  return guardar(almacen, sello({ ...(previo || {}), ...datos }));
}
export async function aPapelera(almacen, id) { return enviarAPapelera(almacen, id, { personaId: persona }); }
export async function deshacerPapelera(almacen, id) { return restaurar(almacen, id, { personaId: persona }); }

export async function guardarConfig(cambios) {
  const actual = (await obtener(ALM.config, 'general')) || { ...CONFIG_BASE, id: 'general' };
  return guardar(ALM.config, sello({ ...actual, ...cambios, id: 'general' }));
}

/** Ficha de RRHH de una persona (se crea vacía si no existe). */
export async function ficha(personaId) { return (await obtener(ALM.fichas, personaId)) || { id: personaId }; }
export async function guardarFicha(personaId, cambios) {
  const actual = await ficha(personaId);
  return guardar(ALM.fichas, sello({ ...actual, ...cambios, id: personaId }));
}

/** Documentos de una persona o vehículo. */
export async function documentosDe(duenoTipo, duenoId) {
  return (await porIndice(ALM.documentos, 'dueno', [duenoTipo, duenoId])).filter(vivo);
}

/**
 * Guarda un documento y, si viene, su archivo (PDF o foto). Carpeta en la nube:
 * personas → «RRHH/Personas/<nombre>» (carpeta solo para RRHH cuando el Sistema esté en Nextcloud); vehículos → «Vehiculos/<patente>».
 */
export async function guardarDocumento(doc, { archivo = null, carpeta = null } = {}) {
  const d = sello({ ...doc });
  if (archivo) {
    const anterior = d.archivoId;
    const a = await guardarArchivo(archivo, { modulo: 'administracion', duenoTipo: `doc_${d.duenoTipo}`, duenoId: d.id, rol: 'documento', carpeta }, { personaId: persona });
    d.archivoId = a.id;
    if (anterior) await archivoAPapelera(anterior, { personaId: persona });
  }
  return guardar(ALM.documentos, d);
}

/** Archivo suelto de la biblioteca o de un encargo (plantilla, norma, bases técnicas…). */
export async function guardarArchivoAdmin(archivo, { duenoTipo, duenoId, proyectoId = null, carpeta = null }) {
  return guardarArchivo(archivo, { modulo: 'administracion', duenoTipo, duenoId, rol: 'documento', proyectoId, carpeta }, { personaId: persona });
}
