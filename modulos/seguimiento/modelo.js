// modulos/seguimiento/modelo.js — reglas del seguimiento de entregas (sin pantalla ni base de datos; se prueba en node).
//
// Un PLAN por proyecto (plantilla): columnas (terreno, productos con extensión, entrega), áreas y tramos, plazo.
// Un CICLO por mes (servicio mensual) o uno solo (trabajo único): nombre, N° de mes del contrato, llegada de datos.
// EVENTOS de solo agregar: { tramoId, tipo: 'terreno'|'prod'|'entrega'|'nota', col, valor, creadoEn }.
// El estado de cada tramo se calcula con el último evento de cada (tipo, col). Deshacer = escribir el valor anterior.

export const ESTADOS = ['falta', 'proc', 'listo'];
export const SIGUIENTE = { falta: 'proc', proc: 'listo', listo: 'falta' };
export const TEXTO_ESTADO = { falta: 'falta', proc: 'en proceso', listo: 'listo' };
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// ─────────── Columnas por defecto ───────────
export const COLS_VUELO = () => [
  { id: 'terreno', tipo: 'terreno', nombre: 'Terreno', ancho: 128, visible: true },
  { id: 'np', tipo: 'producto', nombre: 'NP', ext: '.laz', ancho: 60, visible: true },
  { id: 'mds', tipo: 'producto', nombre: 'MDS', ext: '.asc', ancho: 60, visible: true },
  { id: 'of', tipo: 'producto', nombre: 'OF', ext: '.ecw', ancho: 60, visible: true },
  { id: 'kmz', tipo: 'producto', nombre: 'KMZ', ext: '.kmz', ancho: 60, visible: true },
  { id: 'entrega', tipo: 'entrega', nombre: 'Entrega', ancho: 116, visible: true },
];

// ─────────── Cadenamientos (DM) ───────────
/** «45+200» → 45.2 (km). null si no es un DM. */
export function dmAKm(t) { const m = /(\d+)\s*\+\s*(\d{1,3})/.exec(String(t)); return m ? Number(m[1]) + Number(m[2].padEnd(3, '0')) / 1000 : null; }
export function kmADm(x) { const k = Math.floor(x + 1e-9); return `${k}+${String(Math.round((x - k) * 1000)).padStart(3, '0')}`; }

/**
 * Lee nombres de carpeta (uno por línea; sirven rutas completas copiadas del explorador) y arma los tramos.
 * «008_45+200 - 40+200» → { n: '008', nombre: '40+200 – 45+200', carpeta: '008_45+200 - 40+200', ini: 40.2, fin: 45.2 }
 */
export function tramosDesdeCarpetas(texto, nuevoId) {
  const lineas = String(texto).split(/\r?\n/).map(l => l.trim().replace(/^"|"$/g, '').replace(/[\\/]+$/, '')).filter(Boolean);
  const vistos = new Set(), out = [];
  lineas.forEach((l, i) => {
    const carpeta = l.split(/[\\/]/).pop().trim();
    if (!carpeta || vistos.has(carpeta)) return;
    vistos.add(carpeta);
    const m = /^(\d{1,4})[_\s.-]+(.+)$/.exec(carpeta);
    const n = m ? m[1].padStart(3, '0') : String(i + 1).padStart(3, '0');
    const resto = m ? m[2].trim() : carpeta;
    const dms = resto.split(/\s+-\s+|\s+–\s+/).map(dmAKm);
    let nombre = resto, ini = null, fin = null;
    if (dms.length === 2 && dms[0] != null && dms[1] != null) {
      ini = Math.min(...dms); fin = Math.max(...dms); nombre = `${kmADm(ini)} – ${kmADm(fin)}`;
    }
    out.push({ id: nuevoId(), n, nombre, carpeta, ini, fin });
  });
  return out.sort((a, b) => a.n.localeCompare(b.n, 'es', { numeric: true }));
}

// ─────────── Estado ───────────
const vacio = () => ({ terreno: '', por: '', prod: {}, entrega: '', nota: '', notaPor: '', notaEn: '' });

/** Estado actual de cada tramo a partir de los eventos del ciclo: { tramoId: { terreno, por, prod: {col: estado}, entrega, nota } } */
export function estadoCiclo(eventos) {
  const ord = eventos.filter(e => !e.eliminadoEn).sort((a, b) => (a.creadoEn || '').localeCompare(b.creadoEn || '') || (a.orden || 0) - (b.orden || 0));
  const est = {};
  for (const e of ord) {
    const t = est[e.tramoId] || (est[e.tramoId] = vacio());
    if (e.tipo === 'terreno') { t.terreno = e.valor || ''; t.por = e.valor ? (e.por || '') : ''; }
    else if (e.tipo === 'prod') t.prod[e.col] = e.valor;
    else if (e.tipo === 'entrega') t.entrega = e.valor || '';
    else if (e.tipo === 'nota') { t.nota = e.valor || ''; t.notaPor = e.por || ''; t.notaEn = e.creadoEn || ''; }
  }
  return est;
}

export const estadoDe = (est, tramoId) => est[tramoId] || vacio();
export const productos = plan => plan.cols.filter(c => c.tipo === 'producto');
export const estadoProd = (t, c) => t.prod[c.id] || 'falta';
export const volado = t => !!t.terreno;
export const todoListo = (plan, t) => volado(t) && productos(plan).every(c => estadoProd(t, c) === 'listo');

/** Estado de gabinete: 'na' (no volado) | 'falta' | 'proc' | 'listo' (todo listo, sin entregar) | 'ok' (cargado en entrega). */
export function gabinete(plan, t) {
  if (!volado(t)) return 'na';
  if (t.entrega) return 'ok';
  const es = productos(plan).map(c => estadoProd(t, c));
  if (es.every(e => e === 'falta')) return 'falta';
  return es.every(e => e === 'listo') ? 'listo' : 'proc';
}

export function cuenta(plan, est, tramos) {
  const c = { sinvolar: 0, falta: 0, proc: 0, listo: 0, ok: 0, total: tramos.length, productos: 0, productosListos: 0 };
  const P = productos(plan);
  for (const tr of tramos) {
    const t = estadoDe(est, tr.id), g = gabinete(plan, t);
    if (g === 'na') c.sinvolar++; else c[g]++;
    c.productos += P.length;
    c.productosListos += P.filter(col => volado(t) && estadoProd(t, col) === 'listo').length;
  }
  return c;
}

/**
 * Cambios → eventos nuevos e inversos (para Deshacer). cambios: [{ tramoId, tipo, col?, valor }].
 * Devuelve { eventos: [...], inversos: [...] } sin los que no cambian nada.
 */
export function prepararCambios(est, cambios, { cicloId, planId, por = '' }) {
  const eventos = [], inversos = [];
  let orden = 0;
  for (const c of cambios) {
    const t = estadoDe(est, c.tramoId);
    const antes = c.tipo === 'terreno' ? t.terreno : c.tipo === 'prod' ? (t.prod[c.col] || 'falta') : c.tipo === 'entrega' ? t.entrega : t.nota;
    if ((antes || '') === (c.valor || '')) continue;
    const base = { cicloId, planId, tramoId: c.tramoId, tipo: c.tipo, col: c.col || null };
    eventos.push({ ...base, valor: c.valor, por: c.por ?? por, orden: orden++ });
    inversos.push({ tramoId: c.tramoId, tipo: c.tipo, col: c.col || null, valor: antes || (c.tipo === 'prod' ? 'falta' : ''), por: c.tipo === 'terreno' ? t.por : c.tipo === 'nota' ? t.notaPor : '' });
  }
  return { eventos, inversos };
}

// ─────────── Fechas y plazo ───────────
const aFecha = iso => new Date(iso + 'T12:00:00');
const aISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function sumarHabiles(iso, n) { const d = aFecha(iso); let k = 0; while (k < n) { d.setDate(d.getDate() + 1); const w = d.getDay(); if (w && w !== 6) k++; } return aISO(d); }
export function habilesEntre(a, b) {
  if (a === b) return 0;
  const s = a < b ? 1 : -1, d = aFecha(s > 0 ? a : b), f = aFecha(s > 0 ? b : a); let n = 0;
  while (d < f) { d.setDate(d.getDate() + 1); const w = d.getDay(); if (w && w !== 6) n++; }
  return n * s;
}

/** Vencimiento de la entrega del ciclo: { vence, quedan (días hábiles, negativo = vencida) } o null. */
export function plazoCiclo(plan, ciclo, hoy) {
  const p = plan.plazo || { tipo: 'ninguno' };
  if (ciclo && ciclo.entrega) return { vence: ciclo.entrega, quedan: habilesEntre(hoy, ciclo.entrega) }; // calculada por la periodicidad del proyecto (v0.10)
  if (!ciclo || !ciclo.datos || p.tipo === 'ninguno') return null;
  let vence;
  if (p.tipo === 'habiles') vence = sumarHabiles(ciclo.datos, Math.max(1, Number(p.dias) || 1));
  else { const d = aFecha(ciclo.datos); d.setMonth(d.getMonth() + 1); vence = aISO(d); }
  return { vence, quedan: habilesEntre(hoy, vence) };
}

/** Nombre y N° del mes siguiente: «Octubre 2026», 12 → «Noviembre 2026», 13. */
export function mesSiguiente(nombre, n) {
  const m = /^(\p{L}+)\s+(\d{4})$/u.exec(String(nombre || '').trim());
  const k = m ? MESES.findIndex(x => x.toLowerCase() === m[1].toLowerCase()) : -1;
  if (k < 0) return { nombre: '', mesContrato: (Number(n) || 0) + 1 };
  const y = Number(m[2]) + (k === 11 ? 1 : 0);
  return { nombre: `${MESES[(k + 1) % 12]} ${y}`, mesContrato: (Number(n) || 0) + 1 };
}
export const nombreMes = fecha => { const d = aFecha(fecha); return `${MESES[d.getMonth()]} ${d.getFullYear()}`; };
export const carpetaMes = ciclo => ciclo && ciclo.mesContrato ? `${String(ciclo.mesContrato).padStart(3, '0')} ${(ciclo.nombre || '').split(' ')[0]}`.trim() : '';

// ─────────── Revisar carpeta del mes ───────────
const norm = s => String(s || '').normalize('NFC').trim().toLowerCase();

/**
 * Archivos de una carpeta elegida en el PC (rutas relativas: «012 Octubre/…/008_45+200 - 40+200/x.ecw»)
 * → cambios a «listo» de los productos encontrados y lista de lo que está marcado listo pero no aparece.
 */
export function revisarArchivos(plan, est, rutas) {
  const P = productos(plan).filter(c => c.ext);
  const partes = rutas.map(r => String(r).split(/[\\/]/).map(norm));
  const cambios = [], noEstan = [], encontrados = [];
  for (const area of plan.areas) {
    for (const tr of area.tramos) {
      if (!tr.carpeta) continue;
      const c = norm(tr.carpeta), ca = norm(area.carpeta);
      let deTramo = partes.filter(p => p.slice(0, -1).includes(c));
      // Si el área tiene carpeta propia y hay archivos bajo ella, solo esos (dos áreas pueden tener tramos con el mismo nombre).
      if (ca && deTramo.some(p => p.includes(ca))) deTramo = deTramo.filter(p => p.includes(ca));
      const t = estadoDe(est, tr.id);
      for (const col of P) {
        const hay = deTramo.some(p => p[p.length - 1].endsWith(norm(col.ext)));
        if (hay) { encontrados.push({ tramoId: tr.id, col: col.id }); if (estadoProd(t, col) !== 'listo') cambios.push({ tramoId: tr.id, tipo: 'prod', col: col.id, valor: 'listo' }); }
        else if (volado(t) && estadoProd(t, col) === 'listo') noEstan.push({ tramo: tr, col });
      }
      if (deTramo.length && !volado(t) && P.some(col => deTramo.some(p => p[p.length - 1].endsWith(norm(col.ext))))) cambios.unshift({ tramoId: tr.id, tipo: 'terreno', valor: 'si', por: '' });
    }
  }
  return { cambios, noEstan, encontrados: encontrados.length };
}

// ─────────── Ejemplo (datos ficticios, para probar) ───────────
export function ejemploSaddn(nuevoId) {
  const nombres = ['000_Muelle + Farellón', '001_10+200 - 4+900', '002_15+200 - 10+200', '003_20+200 - 15+200', '004_25+200 - 21+600'];
  for (let n = 5; n <= 31; n++) { const a = 25.2 + (n - 5) * 5; nombres.push(`${String(n).padStart(3, '0')}_${kmADm(n === 31 ? 160 : a + 5)} - ${kmADm(a)}`); }
  return {
    tipo: 'mensual', plazo: { tipo: 'habiles', dias: 10 }, cols: COLS_VUELO(),
    areas: [
      { id: nuevoId(), nombre: '01 Línea de impulsión', carpeta: '01 Línea de impulsión 4+900 - 160+000', tramos: tramosDesdeCarpetas(nombres.join('\n'), nuevoId) },
      { id: nuevoId(), nombre: '03 Distribución DCH', carpeta: '03 Distribución DCH', tramos: [{ id: nuevoId(), n: '001', nombre: 'Distribución DCH', carpeta: '03 Distribución DCH' }] },
      { id: nuevoId(), nombre: '04 Reservorio', carpeta: '04 Reservorio', tramos: [{ id: nuevoId(), n: '001', nombre: 'Reservorio', carpeta: '04 Reservorio' }] },
    ],
  };
}
