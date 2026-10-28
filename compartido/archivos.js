// compartido/archivos.js — archivos asociados (PDF, fotos) comunes a todos los módulos.
// HOY: se guardan en el navegador (almacén compartido_archivos) como dataURL.
// PRÓXIMA VERSIÓN (prueba de nube): cada archivo ya lleva dueño y una ruta prevista; el adaptador de nube
// subirá el contenido a esa ruta y guardará aquí solo la referencia (nube.estado = 'subido').

import { registrarAlmacenes, obtener, todos, guardar } from './almacen.js';
import { sellar } from './util.js';
import { enviarAPapelera } from './papelera.js';
import { descargarArchivo } from './nube.js';

const ALM = 'compartido_archivos';
registrarAlmacenes([{ nombre: ALM, indices: [['dueno', ['duenoTipo', 'duenoId']]] }]);

export const TAMANO_MAXIMO = 15 * 1024 * 1024; // 15 MB por archivo
const LADO_MAXIMO_FOTO = 1600;                 // igual que Terreno Topografía

function leerComoDataURL(blob) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(blob);
  });
}

/** Reduce una foto a 1600 px por lado (JPEG). Si no se puede, devuelve el original. */
async function reducirFoto(archivo) {
  try {
    const url = URL.createObjectURL(archivo);
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    URL.revokeObjectURL(url);
    const escala = Math.min(1, LADO_MAXIMO_FOTO / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * escala); c.height = Math.round(img.height * escala);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return { datos: c.toDataURL('image/jpeg', 0.85), mime: 'image/jpeg' };
  } catch {
    return { datos: await leerComoDataURL(archivo), mime: archivo.type || 'application/octet-stream' };
  }
}

const limpiar = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.\-]+/g, '_').replace(/_+/g, '_');

/**
 * Guarda un archivo.
 * meta: { modulo, duenoTipo, duenoId, rol, proyectoId?, carpeta? }
 *   rol: 'foto' | 'placa' | 'certificado' | 'manual' | 'ficha_tecnica' | 'documento' …
 *   carpeta: ruta lógica en la nube, ej. 'Equipos/Leica TS15 1669403/Certificados'
 */
export async function guardarArchivo(archivo, meta, { personaId = null } = {}) {
  if (archivo.size > TAMANO_MAXIMO) throw new Error(`«${archivo.name}» pesa ${(archivo.size / 1048576).toFixed(1)} MB; el máximo es 15 MB.`);
  const esFoto = (archivo.type || '').startsWith('image/') && meta.rol !== 'documento';
  const { datos, mime } = esFoto ? await reducirFoto(archivo) : { datos: await leerComoDataURL(archivo), mime: archivo.type || 'application/pdf' };
  const nombre = archivo.name || `${meta.rol || 'archivo'}.${mime.split('/')[1] || 'bin'}`;
  const reg = sellar({
    modulo: meta.modulo || '', duenoTipo: meta.duenoTipo, duenoId: meta.duenoId, rol: meta.rol || 'documento',
    proyectoId: meta.proyectoId || null,
    nombre, mime, tamano: Math.round((datos.length - datos.indexOf(',') - 1) * 0.75),
    datos,
    nube: { estado: 'local', ruta: meta.carpeta ? `${meta.carpeta}/${limpiar(nombre)}` : null },
  }, { personaId });
  return guardar(ALM, reg);
}

/** Datos del archivo sin el contenido (para listas). */
export async function infoArchivo(id) {
  const a = id ? await obtener(ALM, id) : null;
  if (!a || a.eliminadoEn) return null;
  const { datos, ...resto } = a;
  return resto;
}

export async function archivosDe(duenoTipo, duenoId) {
  const lista = (await todos(ALM)).filter(a => a.duenoTipo === duenoTipo && a.duenoId === duenoId && !a.eliminadoEn);
  return lista.map(({ datos, ...resto }) => resto).sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
}

function aBlob(dataURL) {
  const [cab, b64] = dataURL.split(',');
  const mime = (cab.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

const urlsCreadas = new Map();
/** URL temporal para mostrar el archivo (img src, enlace). */
export async function urlArchivo(id) {
  if (urlsCreadas.has(id)) return urlsCreadas.get(id);
  const a = id ? await obtener(ALM, id) : null;
  if (!a || a.eliminadoEn) return null;
  if (!a.datos) {
    // Está en la nube pero no en este dispositivo: se baja una vez y queda guardado.
    const blob = await descargarArchivo(a).catch(() => null);
    if (!blob) return null;
    a.datos = await leerComoDataURL(blob);
    await guardar(ALM, a, { silencioso: true });
  }
  const url = URL.createObjectURL(aBlob(a.datos));
  urlsCreadas.set(id, url);
  return url;
}

/** Abre el archivo en otra pestaña (el PDF se ve con el visor del navegador). */
export async function abrirArchivo(id) {
  const info = await infoArchivo(id);
  const url = await urlArchivo(id);
  if (!url) throw new Error(info && info.nube && info.nube.id ? 'El archivo está en la nube: conéctate (☁) para abrirlo.' : 'No se encontró el archivo.');
  const ventana = window.open(url, '_blank');
  if (!ventana) { // ventana bloqueada (algunos teléfonos): se descarga
    const a = document.createElement('a');
    a.href = url; a.download = info?.nombre || 'archivo';
    document.body.appendChild(a); a.click(); a.remove();
  }
}

export async function archivoAPapelera(id, { personaId = null } = {}) {
  urlsCreadas.delete(id);
  return enviarAPapelera(ALM, id, { personaId });
}

export function tamanoLegible(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
