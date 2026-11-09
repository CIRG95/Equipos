// modulos/monografias/comun.js — lógica del paso a paso de Monografías (v0.12). Sin pantallas ni base de datos:
// datos comunes del proyecto, nombres de fichas, tabla pegada desde Excel, conversión UTM ↔ geográficas,
// frases frecuentes y el chequeo de cada ficha con el paso donde se completa cada dato.

import { tmInversa } from '../vuelos/formatos.js';

/** Datos que se escriben una vez en el paso 1. [clave, etiqueta, grupo, tipo] */
export const CAMPOS_COMUNES = [
  ['clienteNombre', 'Cliente', 'doc'], ['nombreProyecto', 'Nombre del proyecto', 'doc'], ['tituloDocumento', 'Título del documento', 'doc'],
  ['tipoMedicion', 'Tipo de medición', 'med'], ['equipoGNSS', 'Equipo', 'med'], ['datumUTM', 'Datum UTM', 'med'], ['zonaUTM', 'Huso UTM', 'med'],
  ['datumGeodesico', 'Datum geodésico', 'med'], ['geoide', 'Geoide', 'med'], ['fechaMedicion', 'Fecha de medición', 'med', 'date'],
  ['operadorNombre', 'Operador', 'resp'], ['operadorCargo', 'Cargo', 'resp'], ['revisoNombre', 'Revisó', 'resp'], ['fechaRevision', 'Fecha de revisión', 'resp', 'date'],
];
export const ETIQUETA = Object.fromEntries(CAMPOS_COMUNES.map(c => [c[0], c[1]]));
export const TIPOS_MEDICION = ['GNSS estático', 'GNSS RTK', 'Estación total'];
/** Qué incluye el PDF (se aplica a todas las fichas). */
export const MODULOS_PDF = [['logoEmpresa', 'Logo de la empresa'], ['logoCliente', 'Logo del cliente'], ['utm', 'Coordenadas UTM'], ['geodesicas', 'Coordenadas geográficas'],
  ['descripcion', 'Descripción'], ['observacion', 'Observación'], ['croquis', 'Croquis'], ['panoramica', 'Vista panorámica'], ['fotos', 'Fotos adicionales'], ['firma', 'Operador y revisión']];
export const MODULOS_DEF = { logoEmpresa: true, logoCliente: true, utm: true, geodesicas: true, descripcion: true, observacion: false, croquis: true, panoramica: true, fotos: false, firma: true };
export const FRASES_BASE = ['Fierro de 12 mm en dado de hormigón', 'Clavo con golilla', 'Pintado en roca', 'Monolito de hormigón con placa', 'A … m del borde de …', 'Ubicado en la cima de …'];

// ─────────── Datos comunes del proyecto ───────────
/** Normaliza lo guardado en el navegador (incluye el formato de v0.11: { ubicacion, firma }). */
export function normalizarComun(c = {}) {
  const todas = {};
  for (const [k] of CAMPOS_COMUNES) todas[k] = c.todas && k in c.todas ? !!c.todas[k] : true;
  return { v: 2, todas, valores: { ...(c.valores || {}) }, modulos: { ...MODULOS_DEF, ...(c.modulos || {}) }, formatoGeo: c.formatoGeo || 'dms', decimalesGeo: c.decimalesGeo ?? 4, frases: Array.isArray(c.frases) ? c.frases : [] };
}
/** Valor del paso 1: el guardado o, si no hay, el de la primera ficha. Y cuántas fichas tienen otro valor. */
export function valorComun(comun, fichas, k) {
  const v = comun.valores[k] ?? (fichas[0] ? fichas[0][k] : '') ?? '';
  const distintas = fichas.filter(f => String(f[k] ?? '') !== String(v ?? '')).length;
  return { v, distintas };
}
export function avanceComun(comun, fichas) {
  const pedidos = CAMPOS_COMUNES.filter(([k]) => comun.todas[k]);
  const faltan = pedidos.filter(([k]) => !String(valorComun(comun, fichas, k).v ?? '').trim()).map(([, t]) => t);
  return { ok: pedidos.length - faltan.length, total: pedidos.length, faltan };
}

// ─────────── Nombres y tabla pegada ───────────
/** «PR-1, PR-2, PR-3» · «PR-1 a PR-12» · «PR-01..PR-05» · una por línea → lista de nombres (máximo 200). */
export function nombresDeTexto(texto) {
  const out = [];
  for (const parte of String(texto || '').split(/[\n,;]+/).map(s => s.trim()).filter(Boolean)) {
    const r = /^(.*?)(\d+)\s*(?:\.\.|\s(?:a|al|hasta)\s)\s*(.*?)(\d+)$/i.exec(parte);
    if (r && (!r[3] || r[3] === r[1])) {
      const a = Number(r[2]), b = Number(r[4]), ancho = r[2].startsWith('0') ? r[2].length : 0, paso = a <= b ? 1 : -1;
      for (let i = a; paso > 0 ? i <= b : i >= b; i += paso) { out.push(r[1] + String(i).padStart(ancho, '0')); if (out.length >= 200) return out; }
    } else out.push(parte);
    if (out.length >= 200) break;
  }
  return [...new Set(out)];
}

/** Número escrito a mano o pegado: «352100.5», «352.100,500», «6 972 345,25». → número o null. */
export function numero(t) {
  let s = String(t ?? '').trim().replace(/\s+/g, '').replace(/m$/i, '');
  if (!s) return null;
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (s.includes(',')) s = s.replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\.(?=.*\.)/g, '');
  const v = Number(s);
  return isFinite(v) ? v : null;
}

/**
 * Tabla copiada de Excel (columnas separadas por tabulación o «;»): Nombre | Este | Norte | Cota.
 * Si la primera fila tiene títulos (Punto, Este, Norte, Cota, E, N, Z…) se usan para ubicar las columnas.
 */
export function leerTabla(texto) {
  const filas = String(texto || '').split(/\r?\n/).map(l => l.split(/\t|;/).map(c => c.trim())).filter(f => f.some(Boolean));
  if (!filas.length) return [];
  let col = { nombre: 0, este: 1, norte: 2, cota: 3 };
  const cab = filas[0].map(c => c.toLowerCase());
  if (cab.length > 1 && numero(cab[1]) == null) {
    const busca = re => cab.findIndex(c => re.test(c));
    const n = busca(/^(nombre|punto|pto|id|c[oó]digo|v[eé]rtice)/), e = busca(/^(este|e|x|easting)$/), no = busca(/^(norte|n|y|northing)$/), z = busca(/^(cota|z|h|altura|elev)/);
    col = { nombre: n >= 0 ? n : 0, este: e >= 0 ? e : 1, norte: no >= 0 ? no : 2, cota: z >= 0 ? z : 3 };
    filas.shift();
  }
  return filas.map(f => ({ nombre: f[col.nombre] || '', este: numero(f[col.este]), norte: numero(f[col.norte]), cota: numero(f[col.cota]) }))
    .filter(r => r.nombre || (r.este != null && r.norte != null));
}

// ─────────── UTM ↔ geográficas (WGS84 / SIRGAS: mismo elipsoide para efectos de la monografía) ───────────
const A = 6378137, F = 1 / 298.257223563;
/** «19 S», «19S», «Huso 19 Sur» → { zona, sur } (sin letra se asume sur). */
export function zonaDe(texto) {
  const m = /(\d{1,2})\s*([NS])?/i.exec(String(texto || ''));
  if (!m) return null;
  const zona = Number(m[1]);
  if (zona < 1 || zona > 60) return null;
  return { zona, sur: !m[2] || m[2].toUpperCase() === 'S' };
}
const parametros = ({ zona, sur }) => ({ lon0: zona * 6 - 183, k0: 0.9996, fe: 500000, fn: sur ? 10000000 : 0, lat0: 0 });
/** Solo se convierte con datums geocéntricos (SIRGAS, WGS84, ITRF); con PSAD56 o SAD69 no. */
export const datumConvertible = d => !d || /SIRGAS|WGS|ITRF/i.test(String(d));

/** Transversal de Mercator directa (Snyder) → [x, y]. */
export function tmDirecta(lon, lat, { lon0, k0, fe, fn, lat0 = 0 }) {
  const e2 = F * (2 - F), ep2 = e2 / (1 - e2), rad = Math.PI / 180;
  const M = phi => A * ((1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 ** 3 / 256) * phi - (3 * e2 / 8 + 3 * e2 * e2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * phi) + (15 * e2 * e2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * phi) - (35 * e2 ** 3 / 3072) * Math.sin(6 * phi));
  const phi = lat * rad, s = Math.sin(phi), c = Math.cos(phi), t = Math.tan(phi);
  const N = A / Math.sqrt(1 - e2 * s * s), T = t * t, C = ep2 * c * c, Aa = c * (lon - lon0) * rad;
  const x = fe + k0 * N * (Aa + (1 - T + C) * Aa ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * Aa ** 5 / 120);
  const y = fn + k0 * (M(phi) - M(lat0 * rad) + N * t * (Aa * Aa / 2 + (5 - T + 9 * C + 4 * C * C) * Aa ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * Aa ** 6 / 720));
  return [x, y];
}
export function utmAGeo(este, norte, zonaTexto) {
  const z = zonaDe(zonaTexto);
  if (!z || este == null || norte == null) return null;
  const [lon, lat] = tmInversa(este, norte, parametros(z));
  return isFinite(lat) && isFinite(lon) ? { lat, lon } : null;
}
export function geoAUtm(lat, lon, zonaTexto) {
  const z = zonaDe(zonaTexto) || { zona: Math.floor((lon + 180) / 6) + 1, sur: lat < 0 };
  if (lat == null || lon == null) return null;
  const [este, norte] = tmDirecta(lon, lat, parametros(z));
  return isFinite(este) && isFinite(norte) ? { este, norte } : null;
}
export const metros = v => (v == null || !isFinite(v) ? '' : v.toFixed(3));

// ─────────── Ficha efectiva (lo que va al PDF) y chequeo por paso ───────────
/** Copia con los módulos que de verdad aplican: «Solo croquis» quita la panorámica; logo del cliente apagado. */
export function efectiva(f) {
  const c = { ...f, modulos: { ...MODULOS_DEF, ...(f.modulos || {}) } };
  if (f.disposicionImg === 'solo-croquis') { c.modulos.panoramica = false; c.disposicionImg = 'lado'; }
  if (c.modulos.logoCliente === false) c.clienteLogo = null;
  return c;
}

const PASO_DE = { Punto: 'coordenadas', 'Coordenadas UTM': 'coordenadas', Geográficas: 'coordenadas', 'H. elipsoidal': 'coordenadas', 'Cota ortométrica': 'coordenadas', Croquis: 'coordenadas', 'Fotografía panorámica': 'coordenadas', 'Fotos adicionales': 'ubicacion' };
/**
 * Chequeo de una ficha para el panel flotante. base = filas de chequeoMonografia (código de Terreno) sobre efectiva(f).
 * Devuelve [{ k, ok, det, aviso, paso }] con paso 'comun' | 'coordenadas' | 'ubicacion'.
 */
export function chequeoFicha(f, base, comun) {
  const t = v => String(v ?? '').trim();
  const mod = efectiva(f).modulos;
  const filas = base.map(r => ({ k: r.k === 'Fotografía panorámica' ? 'Foto panorámica' : r.k, ok: r.ok, det: r.det || '', aviso: r.dup || r.calc || '', paso: PASO_DE[r.k] || 'coordenadas' }));
  filas.push({ k: 'Sector / Lugar', ok: !!t(f.ubicacion), paso: 'ubicacion' });
  filas.push({ k: f.comunaEstimada ? 'Comuna (confirmar)' : 'Comuna', ok: !!t(f.comuna) && !f.comunaEstimada, det: t(f.comuna), paso: 'ubicacion' });
  if (mod.descripcion) filas.push({ k: 'Descripción', ok: !!t(f.descripcion), paso: 'ubicacion' });
  if (mod.firma) {
    const donde = k => (comun.todas[k] ? 'comun' : 'ubicacion');
    filas.push({ k: 'Operador', ok: !!t(f.operadorNombre), det: t(f.operadorNombre), paso: donde('operadorNombre') });
    filas.push({ k: 'Revisó y fecha', ok: !!(t(f.revisoNombre) && t(f.fechaRevision)), det: t(f.revisoNombre), paso: donde('revisoNombre') });
  }
  return filas;
}
export const cuenta = filas => ({ ok: filas.filter(r => r.ok).length, total: filas.length });

/** Ficha nueva con los datos comunes. defaults = valoresPorDefecto() del código de Terreno. */
export function fichaNueva({ id, proyectoId, nombre, defaults, comun, proyecto, extra = {} }) {
  const base = { ...defaults };
  for (const [k] of CAMPOS_COMUNES) if (comun.valores[k] != null && comun.valores[k] !== '') base[k] = comun.valores[k];
  return {
    ...base, id, proyectoId,
    nombreProyecto: base.nombreProyecto || (proyecto ? proyecto.nombre : ''), clienteNombre: base.clienteNombre || (proyecto ? proyecto.mandante || '' : ''),
    tipoMedicion: comun.valores.tipoMedicion || 'GNSS estático', zonaUTM: base.zonaUTM || '19 S', operadorCargo: base.operadorCargo || 'Geomensor',
    puntoMedido: nombre, ubicacion: '', localidad: '', comuna: '', region: '', norte: '', este: '', cotaOrtometrica: '', latitud: '', longitud: '', alturaElipsoidal: '',
    croquisImg: null, panoramicaImg: null, descripcion: '', observacionPdf: '', fotosExtra: [], modulos: { ...comun.modulos }, creado: new Date().toISOString(), ...extra,
  };
}
