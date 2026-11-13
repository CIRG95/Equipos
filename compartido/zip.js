// compartido/zip.js — arma un .zip en el navegador, sin librerías (Sistema v0.15).
// Sirve para «Descargar todo»: una carpeta por persona con sus documentos. Los archivos van sin comprimir
// (método «store»): los PDF y JPG ya vienen comprimidos y así el armado es instantáneo incluso en el teléfono.

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();

export function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = TABLA_CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/** Fecha y hora en formato DOS (lo que pide el zip). */
function fechaDos(d) {
  const hora = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const dia = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { hora, dia };
}

/** Nombre seguro para Windows y Android: sin tildes problemáticas ni caracteres reservados. */
export function nombreSeguro(t) {
  return String(t || 'archivo').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_').replace(/_+/g, '_').replace(/^[_.]+|[_.]+$/g, '') || 'archivo';
}

/**
 * entradas: [{ nombre: 'Carpeta/archivo.pdf', datos: Uint8Array }] → Uint8Array del zip.
 * Los nombres van en UTF-8 (bit 11), así los abre bien Windows 10+, macOS y Android.
 */
export function armarZip(entradas, { fecha = new Date() } = {}) {
  const enc = new TextEncoder();
  const { hora, dia } = fechaDos(fecha);
  const partes = [], central = [];
  let desplazamiento = 0;
  const usados = new Set();
  for (const e of entradas) {
    let nombre = e.nombre;
    // Dos archivos con el mismo nombre en la misma carpeta: se numeran.
    if (usados.has(nombre)) { const p = nombre.lastIndexOf('.'); let k = 2; while (usados.has(`${p > 0 ? nombre.slice(0, p) : nombre}_${k}${p > 0 ? nombre.slice(p) : ''}`)) k++; nombre = `${p > 0 ? nombre.slice(0, p) : nombre}_${k}${p > 0 ? nombre.slice(p) : ''}`; }
    usados.add(nombre);
    const nb = enc.encode(nombre), datos = e.datos, crc = crc32(datos);
    const loc = new DataView(new ArrayBuffer(30));
    loc.setUint32(0, 0x04034b50, true); loc.setUint16(4, 20, true); loc.setUint16(6, 0x0800, true); loc.setUint16(8, 0, true);
    loc.setUint16(10, hora, true); loc.setUint16(12, dia, true); loc.setUint32(14, crc, true);
    loc.setUint32(18, datos.length, true); loc.setUint32(22, datos.length, true); loc.setUint16(26, nb.length, true); loc.setUint16(28, 0, true);
    partes.push(new Uint8Array(loc.buffer), nb, datos);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true); cen.setUint16(10, 0, true);
    cen.setUint16(12, hora, true); cen.setUint16(14, dia, true); cen.setUint32(16, crc, true);
    cen.setUint32(20, datos.length, true); cen.setUint32(24, datos.length, true); cen.setUint16(28, nb.length, true);
    cen.setUint32(42, desplazamiento, true);
    central.push(new Uint8Array(cen.buffer), nb);
    desplazamiento += 30 + nb.length + datos.length;
  }
  const largoCentral = central.reduce((s, p) => s + p.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, entradas.length, true); fin.setUint16(10, entradas.length, true);
  fin.setUint32(12, largoCentral, true); fin.setUint32(16, desplazamiento, true);
  const todo = [...partes, ...central, new Uint8Array(fin.buffer)];
  const salida = new Uint8Array(todo.reduce((s, p) => s + p.length, 0));
  let i = 0; for (const p of todo) { salida.set(p, i); i += p.length; }
  return salida;
}

/** dataURL → Uint8Array (los archivos del Sistema se guardan como dataURL). */
export function bytesDeDataURL(u) {
  const coma = u.indexOf(',');
  const b = atob(u.slice(coma + 1));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}
