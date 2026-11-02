"use strict";

/* =========================================================================
   INDEXEDDB — persistencia local (jornadas y levantamientos, con fotos
   embebidas como dataURL dentro de cada punto)
   ========================================================================= */
const DB_NAME = "terrenoTopoDB";
const DB_VERSION = 2;
let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const _db = e.target.result;
      if (!_db.objectStoreNames.contains("jornadas")) {
        _db.createObjectStore("jornadas", { keyPath: "id" });
      }
      if (!_db.objectStoreNames.contains("levantamientos")) {
        const store = _db.createObjectStore("levantamientos", { keyPath: "id" });
        store.createIndex("jornadaId", "jornadaId", { unique: false });
      }
      if (!_db.objectStoreNames.contains("monografias")) {
        _db.createObjectStore("monografias", { keyPath: "id" });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

function txStore(storeName, mode) {
  return db.transaction(storeName, mode).objectStore(storeName);
}
function dbGetAll(storeName) {
  return new Promise((resolve, reject) => {
    const req = txStore(storeName, "readonly").getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
/* v0.1c — Base para sincronizar más adelante: cada registro lleva quién lo creó
   (dispositivoId), quién lo modificó por última vez, cuándo, y la versión del
   formato de datos. dbPut los sella solo; importar usa {raw:true} para conservar
   los sellos originales. */
const SCHEMA_VERSION = 2;   // 1 = v0.1 / 0.1a / 0.1b (sin sellos); 2 = v0.1c
function getDeviceId() {
  let id = null;
  try { id = localStorage.getItem("dispositivoId"); } catch (_) {}
  if (!id) { id = uuid(); try { localStorage.setItem("dispositivoId", id); } catch (_) {} }
  return id;
}
function sellarRegistro(v) {
  const ahora = nowISO();
  if (!v.creadoEn) v.creadoEn = v.creado || v.fechaInicio || ahora;
  if (!v.dispositivoId) v.dispositivoId = getDeviceId();
  v.modificadoPor = getDeviceId();
  v.actualizadoEn = ahora;
  v.schemaVersion = SCHEMA_VERSION;
}
function dbGet(storeName, id) {
  return new Promise((resolve, reject) => {
    const req = txStore(storeName, "readonly").get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
// Borrado suave: el registro queda en la base marcado como eliminado (papelera),
// así una sincronización futura sabe que se borró y no lo "resucita".
async function dbEliminarSuave(storeName, reg) {
  reg.eliminado = true;
  reg.eliminadoEn = nowISO();
  await dbPut(storeName, reg);
}
const noEliminado = (x) => !x.eliminado;
function dbPut(storeName, value, opts) {
  if (!(opts && opts.raw) && value && typeof value === "object") sellarRegistro(value);
  return new Promise((resolve, reject) => {
    const req = txStore(storeName, "readwrite").put(value);
    req.onsuccess = () => resolve(value);
    req.onerror = () => reject(req.error);
  });
}
function dbDelete(storeName, id) {
  return new Promise((resolve, reject) => {
    const req = txStore(storeName, "readwrite").delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/* =========================================================================
   ESTADO EN MEMORIA
   ========================================================================= */
const state = {
  jornadas: [],
  levantamientos: [],
  monografias: [],
  jornadaActivaId: null,
  levantamientoActivoId: null,
  monografiaEnEdicionId: null, // id de la monografía que se está editando (null = lista)
  tabActual: "jornada",
  puntoUbicacionTemp: null, // {lat,lng} capturada para el punto en edición
  mapModalCallback: null,
  leafletMap: null,
  leafletMarker: null,
  drive: {
    clientId: "",
    conectado: false,
    accessToken: null,
    tokenExpiry: 0,
    tokenClientObj: null,
    rootFolderId: null,
    pendientes: new Set(),
    sincronizando: false
  },
  nextcloud: {
    url: "",
    usuario: "",
    appPassword: "",
    conectado: false,
    pendientes: new Set(),
    sincronizando: false
  },
  config: {
    tolerancia: { modo: "formula", k: 12, fijo: 10 },
    toleranciaTramoVerdeMm: 2,
    toleranciaTramoAmarillaMm: 10,
    marca: { nombreEmpresa: "", logoEmpresa: null }, // logo/nombre propios, fijos para todas las monografías
    fuenteMonografia: { tipo: "carlito", personalizadaRegular: null, personalizadaBold: null, personalizadaNombreRegular: "", personalizadaNombreBold: "" }
  },
  plantillas: [] // plantillas de objetivos de jornada (fábrica + creadas por el usuario)
};
