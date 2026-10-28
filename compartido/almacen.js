// compartido/almacen.js — una sola base IndexedDB ("topoland") para todos los módulos.
// Cada módulo registra sus almacenes (con prefijo propio: equipos_…, gastos_…, terreno_…)
// antes de usarlos. Si falta alguno en la base, se sube la versión y se crea, sin tocar los demás.

const NOMBRE_BD = 'topoland';
const registrados = new Map(); // nombre → { nombre, keyPath, indices: [[nombreIndice, ruta]] }
let promesaBD = null;
let conexion = null;            // la conexión abierta de esta página (se reutiliza)
let cadena = Promise.resolve(); // las aperturas van de a una: dos a la vez chocaban al crear almacenes

export function registrarAlmacenes(definiciones) {
  let nuevos = false;
  for (const d of definiciones) {
    if (!registrados.has(d.nombre)) { registrados.set(d.nombre, d); nuevos = true; }
  }
  if (nuevos) promesaBD = null; // la próxima apertura revisa si hay que crear almacenes
}

export function almacenesRegistrados() { return [...registrados.keys()]; }

// Avisos de cambio: la capa de nube escucha para saber que hay algo nuevo que subir.
// Las escrituras que vienen de la propia sincronización van con { silencioso: true } y no avisan.
const oyentes = new Set();
export function alCambiar(fn) { oyentes.add(fn); return () => oyentes.delete(fn); }
function avisarCambio(almacenes, opciones) {
  if (opciones && opciones.silencioso) return;
  for (const fn of oyentes) { try { fn(almacenes); } catch (e) { console.warn(e); } }
}

function abrirConVersion(version) {
  return new Promise((resolver, rechazar) => {
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
      clearTimeout(aviso);
      const bd = req.result;
      bd.onversionchange = () => { bd.close(); if (conexion === bd) conexion = null; promesaBD = null; };
      resolver(bd);
    };
    req.onerror = () => { clearTimeout(aviso); rechazar(req.error); };
    // «blocked» no es un error: la apertura sigue esperando a que se cierre la otra pestaña.
    // Solo si pasa demasiado tiempo se avisa.
    req.onblocked = () => {
      clearTimeout(aviso);
      aviso = setTimeout(() => rechazar(new Error('La app está abierta en otra pestaña con una versión anterior. Ciérrala y vuelve a intentar.')), 10000);
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

export function abrir() {
  if (promesaBD) return promesaBD;
  const p = cadena.then(async () => {
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

export async function todos(almacen) {
  const bd = await abrir();
  return pedir(bd.transaction(almacen, 'readonly').objectStore(almacen).getAll());
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
  avisarCambio(nombres, opciones);
}

/** Vacía almacenes (por ejemplo, para empezar desde la nube sin datos de prueba locales). */
export async function vaciar(almacenes) {
  if (!almacenes.length) return;
  const bd = await abrir();
  const tx = bd.transaction(almacenes, 'readwrite');
  for (const a of almacenes) tx.objectStore(a).clear();
  await terminar(tx);
  avisarCambio(almacenes, { silencioso: true });
}

export async function borrarDefinitivo(almacen, id) {
  const bd = await abrir();
  const tx = bd.transaction(almacen, 'readwrite');
  tx.objectStore(almacen).delete(id);
  await terminar(tx);
  avisarCambio([almacen]);
}
