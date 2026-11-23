// compartido/almacen.js — una sola base IndexedDB ("sistema_trabajo") para todos los módulos.
// Cada módulo registra sus almacenes (con prefijo propio: equipos_…, gastos_…, terreno_…)
// antes de usarlos. Si falta alguno en la base, se sube la versión y se crea, sin tocar los demás.

import { ESQUEMA } from './esquema.js';
import { BD_ANTERIOR } from './nombres-anteriores.js';

export const NOMBRE_BD = 'sistema_trabajo';
const CLAVE_MIGRADA = 'sistema_bd_migrada'; // v0.21.1: la base anterior ya se copió (vale para el Sistema y Terreno: mismo sitio)
const registrados = new Map(); // nombre → { nombre, keyPath, indices: [[nombreIndice, ruta]] }
let promesaBD = null;
let conexion = null;            // la conexión abierta de esta página (se reutiliza)
let cadena = Promise.resolve(); // las aperturas van de a una: dos a la vez chocaban al crear almacenes

export function registrarAlmacenes(definiciones) {
  let nuevos = false;
  for (const d of definiciones) {
    const previo = registrados.get(d.nombre);
    if (!previo) { registrados.set(d.nombre, { ...d, indices: [...(d.indices || [])] }); nuevos = true; continue; }
    // Ya estaba (p. ej. desde el esquema): se suman los índices que falten.
    for (const ind of (d.indices || [])) {
      if (!previo.indices.some(([n]) => n === ind[0])) { previo.indices.push(ind); nuevos = true; }
    }
  }
  if (nuevos) promesaBD = null; // la próxima apertura revisa si hay que crear almacenes
}

export function almacenesRegistrados() { return [...registrados.keys()]; }
export function definicionesRegistradas() { return [...registrados.values()].map(d => ({ nombre: d.nombre, indices: d.indices.map(i => [...i]) })); }

// El esquema completo se registra siempre, en el Sistema y en el paquete de Terreno (ver esquema.js).
registrarAlmacenes(ESQUEMA);

// Aviso para la pantalla: la base está esperando a que otra app o pestaña la suelte.
const marcar = (k, v) => { try { globalThis[k] = v; } catch { /* sin global */ } };

// Avisos de cambio: la capa de nube escucha para saber que hay algo nuevo que subir.
// Las escrituras que vienen de la propia sincronización van con { silencioso: true } y no avisan.
const oyentes = new Set();
export function alCambiar(fn) { oyentes.add(fn); return () => oyentes.delete(fn); }
function avisarCambio(almacenes, opciones) {
  if (opciones && opciones.silencioso) return;
  for (const fn of oyentes) { try { fn(almacenes); } catch (e) { console.warn(e); } }
}

export const MENSAJE_BLOQUEO = 'Los datos están abiertos en otra app o pestaña (por ejemplo, la app de Terreno en segundo plano). Ciérrala desde las apps recientes y vuelve a abrir.';

function abrirConVersion(version) {
  return new Promise((resolver, rechazar) => {
    marcar('__sistemaBdEsperando', true);
    const listo = () => { marcar('__sistemaBdEsperando', false); marcar('__sistemaBdBloqueada', false); };
    const req = version ? indexedDB.open(NOMBRE_BD, version) : indexedDB.open(NOMBRE_BD);
    req.onupgradeneeded = () => {
      const bd = req.result;
      const tx = req.transaction;
      for (const d of registrados.values()) {
        const almacen = bd.objectStoreNames.contains(d.nombre)
          ? tx.objectStore(d.nombre)
          : bd.createObjectStore(d.nombre, { keyPath: d.keyPath || 'id' });
        for (const [nombreIndice, ruta] of (d.indices || [])) {
          if (!almacen.indexNames.contains(nombreIndice)) almacen.createIndex(nombreIndice, ruta);
        }
      }
    };
    let aviso = null;
    req.onsuccess = () => {
      clearTimeout(aviso); listo();
      const bd = req.result;
      bd.onversionchange = () => { bd.close(); if (conexion === bd) conexion = null; promesaBD = null; };
      resolver(bd);
    };
    req.onerror = () => { clearTimeout(aviso); listo(); rechazar(req.error); };
    // «blocked» no es un error: la apertura sigue esperando a que se cierre la otra pestaña.
    // Solo si pasa demasiado tiempo se avisa.
    req.onblocked = () => {
      clearTimeout(aviso);
      marcar('__sistemaBdBloqueada', true);
      aviso = setTimeout(() => { listo(); rechazar(new Error(MENSAJE_BLOQUEO)); }, 60000);
    };
  });
}

function faltaAlgo(bd) {
  for (const d of registrados.values()) {
    if (!bd.objectStoreNames.contains(d.nombre)) return true;
    if ((d.indices || []).length) {
      const tx = bd.transaction(d.nombre, 'readonly');
      const s = tx.objectStore(d.nombre);
      if (d.indices.some(([n]) => !s.indexNames.contains(n))) return true;
    }
  }
  return false;
}

// v0.21.1 · La primera vez, copia la base con el nombre anterior a la nueva, sin pisar nada que ya exista.
// La base anterior no se borra (queda como respaldo); si estaba vacía (o no existía), se elimina.
let anteriorRevisada = false;
function abrirSimple(nombre) {
  return new Promise((res, rej) => { const r = indexedDB.open(nombre); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error('bloqueada')); });
}
async function traerBaseAnterior() {
  anteriorRevisada = true;
  try { if (localStorage.getItem(CLAVE_MIGRADA)) return; } catch { return; }
  const listo = () => { try { localStorage.setItem(CLAVE_MIGRADA, new Date().toISOString()); } catch { /* */ } };
  let vieja;
  try { vieja = await abrirSimple(BD_ANTERIOR); } catch (e) { console.warn('No se pudo revisar la base anterior', e); return; }
  const nombres = [...vieja.objectStoreNames];
  if (!nombres.length) { vieja.close(); try { indexedDB.deleteDatabase(BD_ANTERIOR); } catch { /* */ } listo(); return; }
  const tx = vieja.transaction(nombres, 'readonly');
  const defs = [], lecturas = [];
  for (const n of nombres) {
    const s = tx.objectStore(n);
    defs.push({ nombre: n, keyPath: s.keyPath || 'id', indices: [...s.indexNames].map(i => [i, s.index(i).keyPath]) });
    lecturas.push(pedir(s.getAll()));
  }
  const datos = await Promise.all(lecturas);
  vieja.close();
  registrarAlmacenes(defs);
  let bd = await abrirConVersion();
  if (faltaAlgo(bd)) { const v = bd.version + 1; bd.close(); bd = await abrirConVersion(v); }
  conexion = bd;
  const tw = bd.transaction(nombres, 'readwrite');
  let copiados = 0;
  nombres.forEach((n, i) => {
    const s = tw.objectStore(n);
    for (const reg of datos[i]) {
      const r = s.add(reg); // add: si el registro ya está en la base nueva, se deja el de la nueva
      r.onsuccess = () => { copiados++; };
      r.onerror = ev => { ev.preventDefault(); ev.stopPropagation(); };
    }
  });
  await terminar(tw);
  console.info(`Datos de la instalación anterior copiados: ${copiados} registros en ${nombres.length} partes.`);
  listo();
}

export function abrir() {
  if (promesaBD) return promesaBD;
  const p = cadena.then(async () => {
    if (!anteriorRevisada && typeof indexedDB !== 'undefined') { try { await traerBaseAnterior(); } catch (e) { console.warn('No se pudieron copiar los datos de la instalación anterior', e); } }
    let bd = conexion || await abrirConVersion();
    if (faltaAlgo(bd)) {
      const v = bd.version + 1;
      bd.close();
      conexion = null;
      bd = await abrirConVersion(v);
    }
    conexion = bd;
    return bd;
  });
  cadena = p.catch(() => {});
  promesaBD = p;
  p.catch(() => { if (promesaBD === p) promesaBD = null; });
  return p;
}

function pedir(req) {
  return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
}

function terminar(tx) {
  return new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });
}

export async function obtener(almacen, id) {
  const bd = await abrir();
  return pedir(bd.transaction(almacen, 'readonly').objectStore(almacen).get(id));
}

// v0.21.1 · Lecturas completas compartidas: una pantalla pedía la misma parte varias veces al pintarse
// (p. ej. equipos, eventos y alertas 3 a 4 veces). Durante 1,5 s se reutiliza la lectura y cada quien recibe
// su propia copia (igual que leer de la base). Cualquier escritura de esta página la descarta al tiro;
// lo que escriba otra pestaña o la app de Terreno se ve, como antes, al pasar a otra pantalla.
const VIGENCIA_LECTURA_MS = 1500;
const lecturas = new Map(); // almacen → { t, promesa }
const clonar = v => (typeof structuredClone === 'function' ? structuredClone(v) : v);
function descartarLecturas(almacenes) { for (const a of almacenes) lecturas.delete(a); }

export async function todos(almacen) {
  let e = lecturas.get(almacen);
  if (!e || Date.now() - e.t > VIGENCIA_LECTURA_MS) {
    const promesa = abrir().then(bd => pedir(bd.transaction(almacen, 'readonly').objectStore(almacen).getAll()));
    e = { t: Date.now(), promesa };
    lecturas.set(almacen, e);
    const esta = e;
    promesa.catch(() => { if (lecturas.get(almacen) === esta) lecturas.delete(almacen); });
  }
  return clonar(await e.promesa);
}

export async function porIndice(almacen, indice, valor) {
  const bd = await abrir();
  return pedir(bd.transaction(almacen, 'readonly').objectStore(almacen).index(indice).getAll(valor));
}

export async function guardar(almacen, registro, opciones) {
  const bd = await abrir();
  const tx = bd.transaction(almacen, 'readwrite');
  tx.objectStore(almacen).put(registro);
  await terminar(tx);
  descartarLecturas([almacen]);
  avisarCambio([almacen], opciones);
  return registro;
}

/** Guarda varios registros, posiblemente en almacenes distintos, en una sola transacción. */
export async function guardarVarios(operaciones, opciones) {
  // operaciones: [{ almacen, registro }]
  if (!operaciones.length) return;
  const bd = await abrir();
  const nombres = [...new Set(operaciones.map(o => o.almacen))];
  const tx = bd.transaction(nombres, 'readwrite');
  for (const o of operaciones) tx.objectStore(o.almacen).put(o.registro);
  await terminar(tx);
  descartarLecturas(nombres);
  avisarCambio(nombres, opciones);
}

/** Vacía almacenes (por ejemplo, para empezar desde la nube sin datos de prueba locales). */
export async function vaciar(almacenes) {
  if (!almacenes.length) return;
  const bd = await abrir();
  const tx = bd.transaction(almacenes, 'readwrite');
  for (const a of almacenes) tx.objectStore(a).clear();
  await terminar(tx);
  descartarLecturas(almacenes);
  avisarCambio(almacenes, { silencioso: true });
}

export async function borrarDefinitivo(almacen, id) {
  const bd = await abrir();
  const tx = bd.transaction(almacen, 'readwrite');
  tx.objectStore(almacen).delete(id);
  await terminar(tx);
  descartarLecturas([almacen]);
  avisarCambio([almacen]);
}
