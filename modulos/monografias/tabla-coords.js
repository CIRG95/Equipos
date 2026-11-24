// modulos/monografias/tabla-coords.js — v0.21.3 · Tabla de coordenadas pegada o cargada desde archivo (lógica pura, con pruebas).
// El usuario elige en el encabezado qué es cada columna (Nombre, E, N, Z o «No usar»), el separador de columnas
// y el separador decimal; la revisión avisa E/N invertidos, celdas que no son número, nombres repetidos y valores raros.

export const ROLES = [['nombre', 'Nombre'], ['este', 'E (Este)'], ['norte', 'N (Norte)'], ['cota', 'Z (Cota)'], ['no', 'No usar']];
export const SEPARADORES = [['auto', 'Automático'], ['tab', 'Tabulación'], ['pyc', 'Punto y coma'], ['coma', 'Coma'], ['espacio', 'Espacios']];
export const DECIMALES = [['auto', 'Automático'], ['punto', 'Punto (352100.50)'], ['coma', 'Coma (352100,50)']];
const RE_SEP = { tab: /\t/, pyc: /;/, coma: /,/, espacio: /\s+/ };

/** Separador de columnas más probable: el que da el mismo número de columnas (≥ 2) en más líneas. */
export function detectarSeparador(texto) {
  const lineas = String(texto || '').split(/\r?\n/).filter(l => l.trim()).slice(0, 30);
  if (!lineas.length) return 'tab';
  let mejor = 'tab', puntaje = -1;
  for (const k of ['tab', 'pyc', 'coma', 'espacio']) {
    const partes = lineas.map(l => l.trim().split(RE_SEP[k]));
    // con coma: si quedan espacios o tabulaciones dentro de las celdas, la coma era el decimal
    if (k === 'coma' && partes.some(p => p.some(c => /\S\s+\S/.test(c.trim())))) continue;
    const n = partes.map(p => p.length);
    if (n[0] < 2) continue;
    const iguales = n.filter(x => x === n[0]).length;
    // la coma solo gana si no parece ser la coma decimal (con coma decimal y tabulación/; ya ganan esos)
    const p = iguales * 10 + n[0] - (k === 'espacio' ? 5 : 0) - (k === 'coma' ? 1 : 0);
    if (p > puntaje) { puntaje = p; mejor = k; }
  }
  return mejor;
}

/** Texto → filas de celdas. */
export function separar(texto, sep = 'auto') {
  const s = sep === 'auto' ? detectarSeparador(texto) : sep;
  const filas = String(texto || '').split(/\r?\n/).map(l => (s === 'espacio' ? l.trim() : l).split(RE_SEP[s] || /\t/).map(c => c.trim().replace(/^"(.*)"$/, '$1'))).filter(f => f.some(Boolean));
  return { filas, sep: s };
}

/** Número con punto o coma decimal. decimal: 'auto' | 'punto' | 'coma'. */
export function numeroCon(t, decimal = 'auto') {
  let s = String(t ?? '').trim().replace(/\s+/g, '').replace(/m$/i, '');
  if (!s) return null;
  if (decimal === 'punto') s = s.replace(/,/g, '');
  else if (decimal === 'coma') s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (s.includes(',')) s = (s.match(/,/g) || []).length > 1 ? s.replace(/,/g, '') : s.replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
  if (!/^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(s)) return null;
  const v = Number(s);
  return isFinite(v) ? v : null;
}

const esTexto = c => c !== '' && numeroCon(c) == null;

/** ¿La primera fila son títulos? Sí, si tiene texto donde las demás filas tienen números. */
export function pareceTitulos(filas) {
  if (filas.length < 2) return filas.length === 1 && filas[0].slice(1).some(esTexto);
  const [a, b] = filas;
  return a.some((c, i) => esTexto(c) && b[i] != null && numeroCon(b[i]) != null);
}

/** Rol de cada columna: por los títulos si hay; si no, por los valores (E 6 dígitos, N 7 dígitos, Z el resto). */
export function detectarColumnas(filas, titulos) {
  const ancho = Math.max(0, ...filas.map(f => f.length));
  const roles = Array(ancho).fill('no');
  const usados = new Set();
  const poner = (i, r) => { if (i >= 0 && i < ancho && roles[i] === 'no' && !usados.has(r)) { roles[i] = r; usados.add(r); } };
  if (titulos && filas.length) {
    const cab = filas[0].map(c => c.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim());
    const busca = re => cab.findIndex((c, i) => roles[i] === 'no' && re.test(c));
    poner(busca(/^(nombre|punto|pto|id|codigo|vertice|pr|estacion|name)\b/), 'nombre');
    poner(busca(/^(este|e|x|easting|coord\.?\s*e)\b/), 'este');
    poner(busca(/^(norte|n|y|northing|coord\.?\s*n)\b/), 'norte');
    poner(busca(/^(cota|z|h|altura|elev|elevacion)\b/), 'cota');
  }
  const datos = titulos ? filas.slice(1) : filas;
  const tipo = i => {
    const v = datos.map(f => numeroCon(f[i])).filter(x => x != null);
    if (!v.length) return 'texto';
    const m = v.reduce((a, b) => a + Math.abs(b), 0) / v.length;
    return m >= 1e6 ? 'norte' : m >= 1e5 ? 'este' : 'cota';
  };
  for (let i = 0; i < ancho; i++) if (roles[i] === 'no') { const t = tipo(i); if (t === 'texto') { if (!usados.has('nombre')) poner(i, 'nombre'); } else poner(i, t); }
  return roles;
}

/** Filas → registros { nombre, este, norte, cota, fila, malos: [rol] } según los roles elegidos. */
export function registros(filas, roles, { titulos = false, decimal = 'auto' } = {}) {
  const col = r => roles.indexOf(r);
  const datos = titulos ? filas.slice(1) : filas;
  return datos.map((f, k) => {
    const r = { fila: k + 1 + (titulos ? 1 : 0), nombre: col('nombre') >= 0 ? (f[col('nombre')] || '').trim() : '', malos: [] };
    for (const c of ['este', 'norte', 'cota']) {
      const i = col(c), crudo = i >= 0 ? (f[i] || '') : '';
      r[c] = crudo ? numeroCon(crudo, decimal) : null;
      if (crudo && r[c] == null) r.malos.push(c);
    }
    return r;
  }).filter(r => r.nombre || r.este != null || r.norte != null);
}

/** Revisión antes de crear: lista de avisos { tipo, texto, filas } y si se puede crear. */
export function revisar(regs, roles) {
  const avisos = [];
  if (!roles.includes('nombre')) avisos.push({ tipo: 'error', texto: 'Falta la columna Nombre.' });
  if (!roles.includes('este') || !roles.includes('norte')) avisos.push({ tipo: 'error', texto: 'Faltan las columnas E y N.' });
  const malos = regs.filter(r => r.malos.length);
  if (malos.length) avisos.push({ tipo: 'error', texto: `${malos.length} fila${malos.length === 1 ? '' : 's'} con valores que no son número (en rojo).`, filas: malos.map(r => r.fila) });
  const sinNombre = regs.filter(r => !r.nombre);
  if (sinNombre.length && roles.includes('nombre')) avisos.push({ tipo: 'error', texto: `${sinNombre.length} fila${sinNombre.length === 1 ? '' : 's'} sin nombre.`, filas: sinNombre.map(r => r.fila) });
  const vistos = new Map();
  for (const r of regs) if (r.nombre) { const k = r.nombre.toLowerCase(); vistos.set(k, (vistos.get(k) || 0) + 1); }
  const rep = [...vistos].filter(([, n]) => n > 1).map(([k]) => k);
  if (rep.length) avisos.push({ tipo: 'error', texto: `Nombres repetidos: ${rep.slice(0, 5).join(', ')}${rep.length > 5 ? '…' : ''}.` });
  const conEN = regs.filter(r => r.este != null && r.norte != null);
  const invertidos = conEN.filter(r => r.este >= 1e6 && r.norte < 1e6);
  if (invertidos.length && invertidos.length >= conEN.length / 2) avisos.push({ tipo: 'invertidos', texto: 'E y N parecen invertidos: el Este tiene 7 dígitos y el Norte 6.' });
  const raros = conEN.filter(r => !(r.este >= 1e5 && r.este < 1e6 && r.norte >= 0 && r.norte <= 1e7));
  if (raros.length && !invertidos.length) avisos.push({ tipo: 'aviso', texto: `${raros.length} fila${raros.length === 1 ? '' : 's'} con E o N fuera de lo normal para UTM (E de 6 dígitos, N hasta 10.000.000). Revisa el separador decimal.`, filas: raros.map(r => r.fila) });
  return { avisos, puedeCrear: regs.length > 0 && !avisos.some(a => a.tipo === 'error') };
}

/** Intercambia los roles E y N. */
export function intercambiarEN(roles) { return roles.map(r => (r === 'este' ? 'norte' : r === 'norte' ? 'este' : r)); }

/** Compatibilidad: lectura automática completa (la usaba la versión anterior). */
export function leerAuto(texto) {
  const { filas } = separar(texto);
  const titulos = pareceTitulos(filas);
  return registros(filas, detectarColumnas(filas, titulos), { titulos });
}
