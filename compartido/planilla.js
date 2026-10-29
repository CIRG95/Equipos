// compartido/planilla.js — lee planillas .xlsx / .xls / .csv y devuelve filas de texto.
// Para Excel usa SheetJS: si la app ya lo cargó (window.XLSX, como Terreno Topografía) lo usa; si no,
// lo carga desde la copia local vendor/xlsx.full.min.js (funciona sin internet).
// Para CSV usa un lector propio que reconoce ";" (Excel en español) o ",".

import { cargarScript, normalizarTexto } from './util.js';

let urlSheetJS = 'vendor/xlsx.full.min.js'; // relativa a la página que monta el módulo
export function configurarSheetJS(url) { urlSheetJS = url; }

export function leerCSV(texto) {
  texto = texto.replace(/^﻿/, '');
  const primera = texto.split(/\r?\n/)[0] || '';
  const sep = (primera.match(/;/g) || []).length >= (primera.match(/,/g) || []).length ? ';' : ',';
  const filas = []; let fila = []; let campo = ''; let entreComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreComillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') entreComillas = false;
      else campo += c;
    } else if (c === '"') entreComillas = true;
    else if (c === sep) { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      fila.push(campo); filas.push(fila); fila = []; campo = '';
    } else campo += c;
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
  return filas;
}

/**
 * Devuelve { hojas: [nombre], hoja, filas: [[celda,...]] } con todas las celdas como vienen
 * (las fechas de Excel llegan como objeto Date).
 */
export async function leerArchivoTabla(archivo, nombreHoja = null) {
  const nombre = (archivo.name || '').toLowerCase();
  if (nombre.endsWith('.csv') || nombre.endsWith('.txt')) {
    return { hojas: ['CSV'], hoja: 'CSV', filas: leerCSV(await archivo.text()) };
  }
  if (!globalThis.XLSX) await cargarScript(urlSheetJS);
  const libro = XLSX.read(await archivo.arrayBuffer(), { type: 'array', cellDates: true });
  const hoja = nombreHoja && libro.SheetNames.includes(nombreHoja) ? nombreHoja : libro.SheetNames[0];
  const filas = XLSX.utils.sheet_to_json(libro.Sheets[hoja], { header: 1, raw: true, defval: '' });
  return { hojas: libro.SheetNames, hoja, filas };
}

/** Busca la fila de encabezados: la primera que contiene al menos `minimo` de las palabras dadas. */
export function encontrarEncabezados(filas, palabrasClave, minimo = 2) {
  const claves = palabrasClave.map(normalizarTexto);
  for (let i = 0; i < Math.min(filas.length, 30); i++) {
    const celdas = filas[i].map(normalizarTexto);
    const hits = claves.filter(k => celdas.some(c => c.includes(k))).length;
    if (hits >= minimo) return i;
  }
  return -1;
}

/**
 * Convierte una celda a fecha aaaa-mm-dd. Acepta Date, número de serie de Excel,
 * dd-mm-aaaa, dd/mm/aaaa, dd.mm.aaaa, aaaa-mm-dd y mm-aaaa (se toma el día 1).
 * Devuelve null si no se puede interpretar.
 */
export function aFechaISO(v) {
  const p = n => String(n).padStart(2, '0');
  const armar = (a, m, d) => {
    if (a < 100) a += 2000;
    if (m < 1 || m > 12 || d < 1 || d > 31 || a < 1950 || a > 2100) return null;
    return `${a}-${p(m)}-${p(d)}`;
  };
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date && !isNaN(v)) {
    // SheetJS entrega la fecha a medianoche UTC; se suma medio día para no correr el día por zona horaria
    const f = new Date(v.getTime() + 12 * 3600000);
    return armar(f.getUTCFullYear(), f.getUTCMonth() + 1, f.getUTCDate());
  }
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const f = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return armar(f.getUTCFullYear(), f.getUTCMonth() + 1, f.getUTCDate());
  }
  const t = String(v).trim();
  let m;
  if ((m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return armar(+m[1], +m[2], +m[3]);
  if ((m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/))) return armar(+m[3], +m[2], +m[1]);
  if ((m = t.match(/^(\d{1,2})[-/.](\d{4})$/))) return armar(+m[2], +m[1], 1);
  if (/^\d+(\.\d+)?$/.test(t)) return aFechaISO(Number(t));
  return null;
}
