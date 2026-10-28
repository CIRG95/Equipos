// compartido/nube.js — sincronización con la nube, común a todos los módulos.
//
// Cómo funciona (pensado para que dos o más personas no se pisen):
//   Carpeta compartida/
//     datos/<dispositivoId>.json   ← cada dispositivo escribe SOLO su archivo, con todo lo que conoce
//     Equipos/…                    ← PDF y fotos, en la ruta que trae cada archivo (nube.ruta)
//   Al sincronizar: 1) se leen los archivos de los demás dispositivos que cambiaron y se mezclan
//   registro por registro (gana el actualizadoEn más reciente, igual que el respaldo .json);
//   2) se suben los PDF/fotos nuevos; 3) se escribe el archivo propio.
// Funciona sin conexión: los cambios quedan marcados y se suben en la próxima sincronización.
// El proveedor (Drive hoy, Nextcloud mañana) es un adaptador; los módulos no lo conocen.

import { almacenesRegistrados, todos, obtener, guardar, guardarVarios, alCambiar, vaciar } from './almacen.js';
import { dispositivoId, ahoraISO } from './util.js';
import { crearAdaptadorDrive, idDeEnlaceDrive } from './nube-drive.js';

const CLAVE = 'topoland_nube';
const PREFIJOS = ['equipos_', 'compartido_'];
const ALM_ARCHIVOS = 'compartido_archivos';
export const NOMBRE_CARPETA_PRUEBA = 'Topoland Equipos (prueba)';

let cfg = leerCfg();
let adaptador = null;
let opcionesAdaptador = {};
const est = { sincronizando: false, error: null, ultimaSync: cfg.ultimaSync || null, ultimoResumen: null };
const oyentesEstado = new Set();
const oyentesDatos = new Set();
let temporizador = null;
let intervalo = null;
let otraVez = false;

function leerCfg() { try { return JSON.parse(localStorage.getItem(CLAVE) || '{}'); } catch { return {}; } }
function guardarCfg() { try { localStorage.setItem(CLAVE, JSON.stringify(cfg)); } catch { /* */ } }

const sincronizable = nombre => PREFIJOS.some(p => nombre.startsWith(p));

// ───────── Estado ─────────

export function estado() {
  return {
    proveedor: 'Google Drive',
    clienteId: cfg.clienteId || '',
    configurado: !!cfg.clienteId,
    conectado: !!(adaptador && adaptador.tokenVigente()),
    carpetaId: cfg.carpetaId || null,
    carpetaNombre: cfg.carpetaNombre || null,
    pendiente: !!cfg.sucio,
    ...est,
  };
}
function emitir() { const e = estado(); for (const fn of oyentesEstado) { try { fn(e); } catch (x) { console.warn(x); } } }
export function alEstado(fn) { oyentesEstado.add(fn); fn(estado()); return () => oyentesEstado.delete(fn); }
/** Se llama cuando llegaron datos de otro dispositivo (para refrescar pantallas). */
export function alDatosRemotos(fn) { oyentesDatos.add(fn); return () => oyentesDatos.delete(fn); }

// ───────── Configuración ─────────

/** La app (envoltorio o app global) entrega el Client ID de Google. `api` solo se cambia para pruebas. */
export function configurar({ clienteId, api } = {}) {
  if (clienteId && clienteId !== cfg.clienteId) { cfg.clienteId = clienteId.trim(); guardarCfg(); adaptador = null; }
  if (api) { opcionesAdaptador.api = api; adaptador = null; }
  if (!adaptador && cfg.clienteId) adaptador = crearAdaptadorDrive({ clienteId: cfg.clienteId, ...opcionesAdaptador });
  emitir();
}

/** Pide permiso a Google (llamar desde un toque). */
export async function conectar({ forzarConsentimiento = false } = {}) {
  configurar();
  if (!adaptador) throw new Error('Falta el Client ID de Google.');
  await adaptador.conectar({ forzarConsentimiento });
  est.error = null;
  emitir();
  if (cfg.carpetaId) programar(200);
}

/** Solo para pruebas automáticas. */
export function conectarConToken(token, segundos = 3600) {
  configurar();
  adaptador.usarToken(token, segundos);
  emitir();
}

export function desconectar({ olvidarCarpeta = false } = {}) {
  if (adaptador) adaptador.desconectar();
  if (olvidarCarpeta) { delete cfg.carpetaId; delete cfg.carpetaNombre; delete cfg.vistos; delete cfg.miArchivoId; guardarCfg(); }
  emitir();
}

export async function buscarCarpetas(nombre = NOMBRE_CARPETA_PRUEBA) {
  return adaptador.buscarCarpetas(nombre);
}

export async function crearCarpeta(nombre = NOMBRE_CARPETA_PRUEBA) {
  const c = await adaptador.crearCarpeta(nombre);
  return usarCarpeta(c.id, { nombre: c.name || nombre });
}

/**
 * Elige la carpeta compartida (id o enlace de Drive).
 * empezarDesdeNube: vacía los datos locales de los módulos antes de bajar los de la carpeta
 * (para no duplicar equipos que se cargaron por separado en cada dispositivo).
 */
export async function usarCarpeta(idOEnlace, { nombre = null, empezarDesdeNube = false } = {}) {
  const id = idDeEnlaceDrive(idOEnlace);
  if (!id) throw new Error('No reconozco ese enlace o id de carpeta de Drive.');
  const d = await adaptador.datosCarpeta(id);
  if (d.mimeType && d.mimeType !== 'application/vnd.google-apps.folder') throw new Error('Ese enlace no es una carpeta.');
  if (d.capabilities && d.capabilities.canAddChildren === false) throw new Error('Tienes acceso de solo lectura a esa carpeta. Pide que te la compartan como «Editor».');
  if (empezarDesdeNube) {
    await vaciar(almacenesRegistrados().filter(sincronizable));
    cfg.sucio = false;
  }
  cfg.carpetaId = id;
  cfg.carpetaNombre = nombre || d.name || id;
  cfg.vistos = {};
  delete cfg.miArchivoId;
  guardarCfg();
  emitir();
  await sincronizar();
  return estado();
}

/** Enlace para el compañero: abre la app y propone usar la misma carpeta. */
export function enlaceInvitacion(baseUrl = location.href) {
  if (!cfg.carpetaId) return null;
  const u = new URL(baseUrl.split('#')[0]);
  u.searchParams.set('carpeta', cfg.carpetaId);
  return u.toString();
}

// ───────── Sincronización ─────────

function programar(ms = 4000) {
  clearTimeout(temporizador);
  temporizador = setTimeout(() => { sincronizar().catch(() => {}); }, ms);
}

/** Arranca la escucha de cambios y la sincronización periódica. Se llama una vez al abrir la app. */
export function iniciar({ cada = 90000 } = {}) {
  configurar();
  alCambiar(almacenes => {
    if (!almacenes.some(sincronizable)) return;
    cfg.sucio = true; guardarCfg(); emitir();
    if (estado().conectado && cfg.carpetaId) programar();
  });
  clearInterval(intervalo);
  intervalo = setInterval(() => { if (estado().conectado && cfg.carpetaId && document.visibilityState === 'visible') sincronizar().catch(() => {}); }, cada);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && estado().conectado && cfg.carpetaId) programar(500); });
  addEventListener('online', () => { if (estado().conectado && cfg.carpetaId) programar(500); });
  if (estado().conectado && cfg.carpetaId) programar(800);
}

const sinDatos = r => { const { datos, ...resto } = r; return resto; };

async function fotografia() {
  const almacenes = {};
  for (const nombre of almacenesRegistrados().filter(sincronizable)) {
    const regs = await todos(nombre);
    almacenes[nombre] = nombre === ALM_ARCHIVOS ? regs.map(sinDatos) : regs;
  }
  return { app: 'topoland', formato: 1, dispositivoId: dispositivoId(), escritoEn: ahoraISO(), almacenes };
}

async function mezclar(remoto) {
  const conocidos = new Set(almacenesRegistrados());
  const ops = [];
  let cambios = 0;
  for (const [nombre, registros] of Object.entries(remoto.almacenes || {})) {
    if (!conocidos.has(nombre) || !sincronizable(nombre)) continue;
    for (const r of registros) {
      if (!r || !r.id) continue;
      const local = await obtener(nombre, r.id);
      if (local && (local.actualizadoEn || '') >= (r.actualizadoEn || '')) continue;
      const nuevo = { ...r };
      if (nombre === ALM_ARCHIVOS && local && local.datos && !nuevo.datos) nuevo.datos = local.datos; // el contenido no cambia
      ops.push({ almacen: nombre, registro: nuevo });
      cambios++;
    }
  }
  if (ops.length) await guardarVarios(ops, { silencioso: true });
  return cambios;
}

async function subirArchivosPendientes(raiz) {
  let n = 0;
  for (const a of await todos(ALM_ARCHIVOS)) {
    if (a.eliminadoEn || !a.datos || (a.nube && a.nube.estado === 'subido')) continue;
    const ruta = (a.nube && a.nube.ruta) || `Archivos/${a.nombre}`;
    const partes = ruta.split('/');
    const nombreArchivo = partes.pop();
    const carpetaId = await adaptador.asegurarRuta(raiz, partes.join('/'));
    const blob = await (await fetch(a.datos)).blob();
    const r = await adaptador.subir({ carpetaId, nombre: nombreArchivo, blob, mime: a.mime || blob.type });
    a.nube = { ...(a.nube || {}), estado: 'subido', id: r.id, ruta };
    a.actualizadoEn = ahoraISO();
    await guardar(ALM_ARCHIVOS, a, { silencioso: true });
    n++;
  }
  return n;
}

/** Sincroniza ahora. Devuelve un resumen { recibidos, archivosSubidos, enviado }. */
export async function sincronizar() {
  if (!adaptador || !adaptador.tokenVigente() || !cfg.carpetaId) return null;
  if (est.sincronizando) { otraVez = true; return null; }
  est.sincronizando = true; est.error = null; emitir();
  const resumen = { recibidos: 0, archivosSubidos: 0, enviado: false };
  try {
    const raiz = cfg.carpetaId;
    const carpetaDatos = await adaptador.asegurarRuta(raiz, 'datos');
    const mio = `${dispositivoId()}.json`;
    cfg.vistos = cfg.vistos || {};

    // 1) Traer lo de los demás
    for (const f of await adaptador.listarArchivos(carpetaDatos)) {
      if (!f.name.endsWith('.json')) continue;
      if (f.name === mio) { cfg.miArchivoId = f.id; continue; }
      if (cfg.vistos[f.id] === f.modifiedTime) continue;
      const remoto = JSON.parse(await (await adaptador.descargar(f.id)).text());
      resumen.recibidos += await mezclar(remoto);
      cfg.vistos[f.id] = f.modifiedTime;
    }

    // 2) Subir PDF y fotos nuevos (antes del archivo propio, para que viaje su id en la nube)
    resumen.archivosSubidos = await subirArchivosPendientes(raiz);

    // 3) Escribir el archivo propio si hay algo nuevo (cambios locales, recibidos o archivos)
    if (cfg.sucio || resumen.recibidos || resumen.archivosSubidos || !cfg.miArchivoId) {
      cfg.sucio = false; guardarCfg();
      const blob = new Blob([JSON.stringify(await fotografia())], { type: 'application/json' });
      const r = await adaptador.subir({ carpetaId: carpetaDatos, nombre: mio, blob, mime: 'application/json', archivoId: cfg.miArchivoId || null });
      cfg.miArchivoId = r.id;
      resumen.enviado = true;
    }
    cfg.ultimaSync = est.ultimaSync = ahoraISO();
    est.ultimoResumen = resumen;
    guardarCfg();
    if (resumen.recibidos) for (const fn of oyentesDatos) { try { fn(resumen); } catch (x) { console.warn(x); } }
    return resumen;
  } catch (e) {
    console.warn('Sincronización:', e);
    est.error = e.message;
    if (!e.sinToken) { cfg.sucio = true; guardarCfg(); }
    throw e;
  } finally {
    est.sincronizando = false;
    emitir();
    if (otraVez) { otraVez = false; programar(1000); }
  }
}

/** Contenido de un archivo que está en la nube y no en este dispositivo. */
export async function descargarArchivo(registro) {
  if (!registro || !registro.nube || !registro.nube.id) return null;
  if (!adaptador || !adaptador.tokenVigente()) return null;
  return adaptador.descargar(registro.nube.id);
}
