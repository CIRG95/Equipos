// modulos/vuelos/hoja.js — la hoja de vuelo: modelo de datos, migración y cálculos (área, sectores, vuelo).
// Sin pantalla: las funciones reciben la hoja y devuelven resultados.

import { hoyISO } from '../../compartido/util.js';
import { proyectar, calcularPlan, alturaParaGsd, gsdCm, areaM2 } from './calculo.js';
import { margenPoligono, aplicarCortes, cortarEje, poligonoCorredor, largo, cortesTransversales, distanciaEnEje, puntoEnEje } from './geom.js';
import { prolongarCorte } from './cerrados.js';

const R_LAT = 110540, R_LON = 111320;

export const PARAMS_INICIALES = {
  modo: 'foto', porGsd: true, gsd: 2.5, altura: 100, traslapeFrontal: 80, traslapeLateral: 70,
  velocidad: '', exposicion: 1000, reserva: 25, minDespegue: 3, minCambio: 5, segGiro: 8,
};

export const DOCUMENTOS_DGAC = [
  ['kmz', 'KMZ de la zona'], ['carta', 'Carta o autorización del mandante'], ['seguro', 'Seguro aprobado por la JAC'],
  ['credencial', 'Credencial del piloto vigente'], ['inscripcion', 'Inscripción del dron'],
];
// ─────────── Documentos de la solicitud según el tipo de zona (v0.11) ───────────
export const ZONAS_VUELO = [
  ['no_poblada', 'Área no poblada · DAN 91'], ['poblada', 'Área poblada · DAN 151'], ['especial', 'Zona especial'],
];
export const DOCS_PERMISO = {
  comunes: [
    ['aoc', 'Certificado AOC', true], ['registro', 'Registro del RPA', false], ['licencia', 'Licencia / credencial de operador', true],
    ['formulario', 'Formulario de solicitud', false], ['kmz', 'KMZ del polígono', false], ['lugar', 'Permiso del lugar a volar', false],
    ['seguro', 'Seguro de responsabilidad civil vigente', true], ['espacio', 'Verificación del espacio aéreo (aeródromos y zonas)', false],
    ['faena', 'Acreditación en faena del mandante (si aplica)', false], ['resolucion', 'Respuesta o resolución de la DGAC', true],
  ],
  no_poblada: [['dan91', 'Solicitud al Subdepartamento de Operaciones (SDO) · Formulario DAN 91 Anexo D', false]],
  poblada: [
    ['apendiceA', 'Autorización Apéndice A DAN 151 vigente', true], ['carta151', 'Carta tipo de solicitud (DAN 151 · interés público)', false],
    ['carpeta', 'Carpeta operativa: credencial de operador, tarjeta de registro del RPA y resolución del seguro aprobado por la JAC', false],
  ],
  especial: [
    ['permisoInst', 'Permiso escrito de la institución o administración del lugar', false],
    ['aprobDgac', 'Aprobación formal de la DGAC', true],
  ],
};
export const ESTADOS_DOC = [['falta', 'Falta'], ['tramite', 'En trámite'], ['adjunto', 'Listo / adjunto'], ['no_aplica', 'No aplica']];
// Documentos de la v0.10 (casillas) → documentos nuevos.
const DOC_ANTIGUO = { kmz: 'kmz', carta: 'lugar', seguro: 'seguro', credencial: 'licencia', inscripcion: 'registro' };

/** Lista de documentos que pide la hoja según su zona: [{ k, t, vence (pide fecha), estado, fechaVence, archivoId, listo }]. */
export function documentosPermiso(h) {
  const p = h.permisos || {}, zona = p.zona || 'no_poblada', est = p.docsEstado || {};
  const tieneArea = !!(h.area && (h.area.original || h.area.eje));
  return [...DOCS_PERMISO.comunes, ...(DOCS_PERMISO[zona] || [])].map(([k, t, vence]) => {
    const e = est[k] || {};
    let estado = e.estado;
    if (!estado) estado = (k === 'kmz' && tieneArea) || Object.entries(DOC_ANTIGUO).some(([a, n]) => n === k && (p.docs || {})[a]) ? 'adjunto' : 'falta';
    return { k, t, vence, estado, fechaVence: e.vence || '', archivoId: e.archivoId || null, listo: estado === 'adjunto' || estado === 'no_aplica' };
  });
}

export const CONSULTAS = [
  ['notam', 'NOTAM en AIP Chile', 'https://aipchile.dgac.gob.cl/notam'],
  ['aip', 'Mapa interactivo AIP Chile', 'https://aipchile.dgac.gob.cl/'],
  ['uas', 'UAS Control: zonas y «Verificar conformidad» del área', 'https://uascontrol.io/'],
];

export function nuevaHoja({ proyectoId = '', personaId = null, dronId = 'm4e' } = {}) {
  return {
    nombre: '', proyectoId: proyectoId || null, fecha: hoyISO(), pilotoId: personaId, estado: 'borrador',
    dronId, params: { ...PARAMS_INICIALES },
    area: {
      tipo: null, original: null, eje: null, archivo: '', margen: 0, rectas: true,
      corredor: { izq: 40, der: 40, mismo: true, invertir: false },
      cortes: [], sectores: [], sel: 0,
    },
    clima: null,
    permisos: { dgac: { preparado: '', enviado: '', aprobado: '', vence: '', numero: '' }, docs: {}, consultas: [], zona: 'no_poblada', docsEstado: {}, logs: [] },
    mandante: '', jefe: '', ubicacion: null, procesado: false,
    viento: [],
  };
}

/** Planes de la v0.2–0.3 (params + poligono) → hoja de vuelo. Las hojas nuevas pasan sin cambios. */
export function migrarHoja(p) {
  if (p.area) {
    const h = nuevaHoja();
    return { ...h, ...p, params: { ...PARAMS_INICIALES, ...p.params }, area: { ...h.area, ...p.area, corredor: { ...h.area.corredor, ...(p.area.corredor || {}) } }, permisos: { ...h.permisos, ...(p.permisos || {}), dgac: { ...h.permisos.dgac, ...((p.permisos || {}).dgac || {}) } } };
  }
  const h = nuevaHoja({ proyectoId: p.proyectoId, dronId: p.dronId || 'm4e' });
  const { despegue = null, rumbo = '', dronId, areaHa, ...params } = p.params || {};
  return {
    ...h, id: p.id, nombre: p.nombre || '', creadoEn: p.creadoEn, creadoPor: p.creadoPor,
    dronId: p.dronId || dronId || 'm4e', params: { ...PARAMS_INICIALES, ...params },
    area: { ...h.area, tipo: p.poligono ? 'poligono' : null, original: p.poligono ? { nombre: p.poligono.nombre, anillo: p.poligono.anillo } : null, archivo: p.poligono ? 'guardado en el plan' : '', sectores: [{ despegue, rumbo }], areaHa: areaHa || '' },
  };
}

/** Marco local en metros alrededor del área original (el mismo para todos los sectores de la hoja). */
export function marcoDe(coords) {
  const { lat0, lon0 } = proyectar(coords);
  const k = Math.cos(lat0 * Math.PI / 180) * R_LON;
  return {
    lat0, lon0,
    aXY: ([lon, lat]) => [(lon - lon0) * k, (lat - lat0) * R_LAT],
    aLonLat: ([x, y]) => [lon0 + x / k, lat0 + y / R_LAT],
    aLatLng: ([x, y]) => [lat0 + y / R_LAT, lon0 + x / k],
  };
}

const centroide = pts => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];

let cacheGeo = { clave: '', valor: null };
/**
 * Geometría de la hoja: área de vuelo (con margen o corredor) y sectores (después de los cortes).
 * Devuelve null si no hay área. Todo en el marco local (metros) más el marco para convertir.
 */
export function geometria(hoja) {
  const a = hoja.area;
  const fuente = a.tipo === 'corredor' ? (a.eje && a.eje.linea) : (a.original && a.original.anillo);
  if (!fuente || fuente.length < 2) return null;
  const clave = JSON.stringify([a.tipo, fuente, a.margen, a.rectas, a.corredor, a.cortes, a.dm, a.ejeCalc ? a.ejeCalc.linea : null]); // con todos los vértices: dos áreas con el mismo primer y último punto no deben compartir caché
  if (cacheGeo.clave === clave) return cacheGeo.valor;
  const marco = marcoDe(fuente);
  const cortes = (a.cortes || []).map(c => c.map(marco.aXY));
  let valor;
  if (a.tipo === 'corredor') {
    let eje = fuente.map(marco.aXY);
    if (a.corredor.invertir) eje = eje.slice().reverse();
    const izq = Number(a.corredor.izq) || 0, der = a.corredor.mismo ? izq : (Number(a.corredor.der) || 0);
    const tramos = cortarEje(eje, cortes);
    const sectores = tramos.map(t => ({ eje: t, poligono: poligonoCorredor(t, izq, der), largo: largo(t) }));
    sectores.forEach(s => { s.area = areaM2(s.poligono); });
    // DM de cada sector (si la hoja tiene el DM del inicio del eje): sirve para nombrarlos «10+200 – 15+200».
    const ejeOrig = fuente.map(marco.aXY), Lo = largo(ejeOrig);
    for (const s of sectores) s.rango = [distanciaEnEje(ejeOrig, s.eje[0]), distanciaEnEje(ejeOrig, s.eje[s.eje.length - 1])].sort((x, y) => x - y);
    if (a.dm && a.dm.inicio != null) for (const s of sectores) s.dm = s.rango.map(x => kmEnEje(a, x, Lo)).sort((x, y) => x - y);
    // Sentido invertido (v0.9): el inicio (S1) es el otro extremo del eje.
    if (a.dm && a.dm.inv) sectores.sort((x, y) => (y.rango[0] + y.rango[1]) - (x.rango[0] + x.rango[1]));
    valor = { marco, tipo: 'corredor', eje, izq, der, vuelo: poligonoCorredor(eje, izq, der), original: null, sectores, fallidos: cortes.length && tramos.length < cortes.length + 1 ? ['algún corte no cruza el eje'] : [] };
  } else {
    const original = fuente.map(marco.aXY);
    const vuelo = Number(a.margen) > 0 ? margenPoligono(original, Number(a.margen), { rectas: a.rectas !== false }) : original;
    const { sectores, fallidos } = aplicarCortes(vuelo, cortes.map(c => prolongarCorte(c, vuelo)));
    let secs = sectores.map(p => ({ poligono: p, area: areaM2(p) }));
    // Área lineal con eje calculado: sectores en el orden del eje y, con DM, nombrados por su tramo (v0.8).
    if (a.ejeCalc && a.ejeCalc.linea && secs.length > 1) {
      const ejeXY = a.ejeCalc.linea.map(marco.aXY), Le = largo(ejeXY);
      for (const sec of secs) {
        const pts = sec.poligono, paso = Math.max(1, Math.ceil(pts.length / 300));
        let mn = Infinity, mx = -Infinity;
        for (let i = 0; i < pts.length; i += paso) { const d = distanciaEnEje(ejeXY, pts[i]); if (d < mn) mn = d; if (d > mx) mx = d; }
        sec.rango = [mn, mx];
        if (a.dm && a.dm.inicio != null) sec.dm = [kmEnEje(a, mn, Le), kmEnEje(a, mx, Le)].sort((x, y) => x - y);
      }
      const signo = a.dm && a.dm.inv ? -1 : 1; // sentido invertido: S1 en el otro extremo
      secs.sort((x, y) => signo * ((x.rango[0] + x.rango[1]) - (y.rango[0] + y.rango[1])));
    }
    valor = { marco, tipo: 'poligono', original, vuelo, sectores: secs, fallidos };
  }
  valor.areaVuelo = areaM2(valor.vuelo);
  cacheGeo = { clave, valor };
  return valor;
}

/** Datos guardados de un sector (despegue, rumbo, nombre), creando los que falten. */
export function metaSector(hoja, i) {
  const s = hoja.area.sectores;
  while (s.length <= i) s.push({ despegue: null, rumbo: '', nombre: '' });
  return s[i];
}

export function nombreSector(hoja, i, total) {
  const m = hoja.area.sectores[i];
  if (m && m.nombre) return m.nombre;
  const g = hoja.area.dm ? geometria(hoja) : null;
  const s = g && g.sectores[i];
  if (s && s.dm && total > 1) return `${kmADm(s.dm[0])} – ${kmADm(s.dm[1])}`;
  return total > 1 ? `S${i + 1}` : 'Área completa';
}

// ─────────── Cadenamiento (DM) y cortes automáticos del corredor ───────────
/**
 * Sentido del eje (v0.9). El eje se guarda tal como vino del KML; h.area.dm.inv = true pone el inicio (DM del inicio)
 * en su último vértice. s = metros desde el primer vértice guardado; L = largo del eje.
 */
export const desdeInicio = (a, s, L) => (a.dm && a.dm.inv ? L - s : s);
/** DM (km) del punto a s metros del primer vértice guardado. Sin DM del inicio cuenta desde 0+000. */
export function kmEnEje(a, s, L) {
  const dm = a.dm || {}, ini = dm.inicio != null ? dm.inicio : 0, x = desdeInicio(a, s, L) / 1000;
  return dm.desc ? ini - x : ini + x;
}
/** Metros desde el primer vértice guardado del punto con ese DM (km). */
export function sDeKm(a, km, L) {
  const dm = a.dm || {}, ini = dm.inicio != null ? dm.inicio : 0;
  return desdeInicio(a, (dm.desc ? ini - km : km - ini) * 1000, L);
}
/** Línea del eje (lon/lat, en el orden guardado) que usa la hoja: la del corredor o la calculada del área lineal. */
export function lineaEje(a) { return a.tipo === 'corredor' ? (a.eje && a.eje.linea) : (a.ejeCalc && a.ejeCalc.linea) || null; }

/** «45+200» → 45.2 (km); null si no se entiende. */
export function dmAKm(t) { const m = /^\s*(\d+)\s*\+\s*(\d{1,3})(?:[.,](\d+))?\s*$/.exec(String(t)); if (m) return Number(m[1]) + Number(m[2].padEnd(3, '0')) / 1000; const n = Number(String(t).replace(',', '.')); return isFinite(n) && String(t).trim() !== '' ? n : null; }
export function kmADm(x) { const k = Math.floor(x + 1e-9); return `${k}+${String(Math.round((x - k) * 1000)).padStart(3, '0')}`; }

/**
 * Distancias (m desde el inicio del eje, en su sentido original) donde cortar.
 * op: { modo: 'inicio'|'dm'|'tramos', cada (m), dmInicio (km), desc (el DM baja en el sentido del eje), primerDM (km), tramosKm: [km…] }
 */
export function distanciasCorte(L, op) {
  const out = [];
  const aS = km => (op.desc ? op.dmInicio - km : km - op.dmInicio) * 1000;
  if (op.modo === 'inicio') { const c = Number(op.cada); if (c > 10) for (let s = c; s < L; s += c) out.push(s); }
  else if (op.modo === 'dm') {
    const c = Number(op.cada); if (!(c > 10) || op.dmInicio == null) return out;
    const ref = op.primerDM != null ? op.primerDM : 0; // sin primer DM: múltiplos redondos (11+000, 12+000…)
    const kmFin = op.desc ? op.dmInicio - L / 1000 : op.dmInicio + L / 1000;
    const [a, b] = [op.dmInicio, kmFin].sort((x, y) => x - y);
    const paso = c / 1000;
    for (let k = ref + Math.ceil((a - ref) / paso) * paso; k <= b + 1e-9; k += paso) out.push(aS(k));
  } else if (op.modo === 'tramos' && op.dmInicio != null) out.push(...(op.tramosKm || []).map(aS));
  return [...new Set(out.map(s => Math.round(s * 10) / 10))].filter(s => s > 1 && s < L - 1).sort((x, y) => x - y);
}

/** Cortes (en lon, lat) para guardar en la hoja: perpendiculares al eje original, un poco más largos que el corredor. */
export function cortesDeCorredor(hoja, distancias) {
  const a = hoja.area, marco = marcoDe(a.eje.linea), eje = a.eje.linea.map(marco.aXY);
  const semi = Math.max(Number(a.corredor.izq) || 0, a.corredor.mismo ? 0 : Number(a.corredor.der) || 0) + 40;
  return cortesTransversales(eje, distancias, semi).map(c => c.map(marco.aLonLat));
}

/** Cortes para que cada sector se vuele con a lo más n baterías desde un despegue en su centro. Devuelve distancias. */
export function distanciasPorBaterias(hoja, d, n, ejeDado = null) {
  const a = hoja.area;
  let eje, izq, der;
  if (ejeDado) ({ eje, izq, der } = ejeDado); // área lineal: eje calculado y medio ancho promedio a cada lado
  else { const marco = marcoDe(a.eje.linea); eje = a.eje.linea.map(marco.aXY); izq = Number(a.corredor.izq) || 0; der = a.corredor.mismo ? izq : (Number(a.corredor.der) || 0); }
  const L = largo(eje);
  const pedazo = (s0, s1) => { const pts = [puntoEnEje(eje, s0).p]; let acum = 0; for (let i = 0; i + 1 < eje.length; i++) { acum += Math.hypot(eje[i + 1][0] - eje[i][0], eje[i + 1][1] - eje[i][1]); if (acum > s0 && acum < s1) pts.push(eje[i + 1]); } pts.push(puntoEnEje(eje, s1).p); return pts; };
  const baterias = (s0, s1) => {
    const sub = pedazo(s0, s1), medio = puntoEnEje(eje, (s0 + s1) / 2).p;
    const b = baseCalculo(hoja, d, { eje: sub, izq, der, despegue: medio });
    const v = Number(hoja.params.velocidad) || Math.floor(calcularPlan({ ...b, velocidad: 10 }).velSugerida * 10) / 10;
    return calcularPlan({ ...b, velocidad: v }).vuelos;
  };
  const out = []; let s0 = 0;
  while (L - s0 > 1 && out.length < 200) {
    if (baterias(s0, L) <= n) break;
    let lo = s0 + 20, hi = L;
    if (baterias(s0, lo) > n) { out.push(lo); s0 = lo; continue; }
    while (hi - lo > 25) { const m = (lo + hi) / 2; if (baterias(s0, m) <= n) lo = m; else hi = m; }
    out.push(Math.round(lo)); s0 = lo;
  }
  return out;
}

export const alturaDe = (P, d) => P.porGsd ? alturaParaGsd(d, Number(P.gsd) || 1) : Number(P.altura) || 1;

/** Parámetros de cálculo comunes (del plan) para un dron. */
export function baseCalculo(hoja, d, extra = {}) {
  const P = hoja.params;
  return {
    dron: d, modo: P.modo === 'lidar' && d.lidar ? 'lidar' : 'foto', altura: alturaDe(P, d),
    traslapeFrontal: (Number(P.traslapeFrontal) || 0) / 100, traslapeLateral: (Number(P.traslapeLateral) || 0) / 100,
    exposicion: 1 / (Number(P.exposicion) || 1000), reserva: (Number(P.reserva) || 0) / 100,
    minDespegue: Number(P.minDespegue) || 0, minCambio: Number(P.minCambio) || 0, segGiro: Number(P.segGiro) || 0,
    fotosEnLidar: false, ...extra,
  };
}

/** Cálculo de vuelo de un sector. extra puede cambiar altura, velocidad, rumbo… (tabla de opciones, «Más corto»). */
export function calcularSector(hoja, d, geo, i, extra = {}) {
  const sec = geo.sectores[i];
  if (!sec) return null;
  const meta = metaSector(hoja, i);
  const geomSector = geo.tipo === 'corredor'
    ? { eje: sec.eje, izq: geo.izq, der: geo.der }
    : { puntos: sec.poligono, rumbo: meta.rumbo === '' || meta.rumbo == null ? undefined : Number(meta.rumbo) };
  const despegue = extra.despegue || (meta.despegue ? geo.marco.aXY(meta.despegue) : centroide(sec.poligono));
  const b = baseCalculo(hoja, d, { ...geomSector, despegue, ...extra });
  const P = hoja.params;
  if (extra.velocidad) return { ...calcularPlan(b), velocidad: extra.velocidad, despegueXY: despegue, altura: b.altura, modo: b.modo };
  const previo = calcularPlan({ ...b, velocidad: 10 });
  const sugerida = Math.floor(previo.velSugerida * 10) / 10;
  const velocidad = Number(P.velocidad) || sugerida;
  return { ...calcularPlan({ ...b, velocidad }), velocidad, sugerida, auto: !Number(P.velocidad), despegueXY: despegue, modo: b.modo, altura: b.altura };
}

/** Rumbo (0–179°) que da menos minutos de jornada en el sector i con su despegue: cada 5° y luego afina de a 1°. */
export function rumboMasCorto(hoja, d, geo, i, velocidad) {
  const prueba = r => calcularSector(hoja, d, geo, i, { rumbo: r, velocidad }).minTotal;
  let mejor = 0, minimo = Infinity;
  for (let r = 0; r < 180; r += 5) { const m = prueba(r); if (m < minimo - 1e-6) { minimo = m; mejor = r; } }
  for (let r = mejor - 4; r <= mejor + 4; r++) { const rr = (r + 180) % 180; const m = prueba(rr); if (m < minimo - 1e-6) { minimo = m; mejor = rr; } }
  return { rumbo: mejor, minTotal: minimo };
}

/** Totales de la hoja (todos los sectores). */
export function totales(hoja, d, geo) {
  if (!geo || !d) return null;
  const rs = geo.sectores.map((_, i) => calcularSector(hoja, d, geo, i));
  return {
    sectores: rs,
    baterias: rs.reduce((s, r) => s + (r ? r.vuelos : 0), 0),
    minVuelo: rs.reduce((s, r) => s + (r ? r.minMision : 0), 0),
    minJornada: rs.reduce((s, r) => s + (r ? r.minTotal : 0), 0),
    fotos: rs.reduce((s, r) => s + (r ? r.fotos : 0), 0),
    gsd: rs[0] ? rs[0].gsd : gsdCm(d, alturaDe(hoja.params, d)),
    altura: rs[0] ? rs[0].altura : alturaDe(hoja.params, d),
    excede: rs.some(r => r && r.baterias.some(b => b.excede)),
  };
}

/** Días hábiles (lunes a viernes) entre dos fechas ISO, sin contar la primera. */
export function diasHabiles(desde, hasta) {
  if (!desde || !hasta) return null;
  let n = 0;
  const d = new Date(desde + 'T12:00:00'), f = new Date(hasta + 'T12:00:00');
  if (f <= d) return 0;
  while (d < f) { d.setDate(d.getDate() + 1); const w = d.getDay(); if (w !== 0 && w !== 6) n++; }
  return n;
}

/** Estado del permiso DGAC para mostrar: { texto, nivel: 'ok'|'aviso'|'gris', detalle }. */
export function estadoPermiso(hoja) {
  const g = hoja.permisos.dgac;
  if (g.aprobado) {
    if (g.vence && g.vence < hoja.fecha) return { texto: 'Vencido', nivel: 'aviso', detalle: `venció ${g.vence}` };
    return { texto: 'Aprobado', nivel: 'ok', detalle: g.vence ? `vigente hasta ${g.vence}` : 'sin fecha de término' };
  }
  if (g.enviado) {
    const h = diasHabiles(g.enviado, hoja.fecha);
    return { texto: 'Enviado', nivel: 'aviso', detalle: h != null && h < 7 ? `solo ${h} días hábiles antes del vuelo (piden 7)` : 'esperando respuesta' };
  }
  if (g.preparado) return { texto: 'En preparación', nivel: 'aviso', detalle: 'falta enviarlo' };
  return { texto: 'Sin iniciar', nivel: 'gris', detalle: 'mín. 7 días hábiles antes' };
}

// ─────────── Etapa del vuelo (v0.11): Planificación → Permisos → Programado → Volado → Log cargado → Procesado ───────────
export const ETAPAS_VUELO = [
  ['planificacion', 'Planificación', 'gris'], ['permisos', 'Permisos', 'ambar'], ['programado', 'Programado', 'azul'],
  ['volado', 'Volado', 'verde'], ['log', 'Log cargado', 'verde'], ['procesado', 'Procesado', 'gris'],
];
export const NOMBRE_ETAPA_VUELO = Object.fromEntries(ETAPAS_VUELO.map(([k, t]) => [k, t]));
export function etapaVuelo(h) {
  const logs = (h.permisos && h.permisos.logs) || [];
  if (h.procesado) return 'procesado';
  if (h.estado === 'volada') return logs.length ? 'log' : 'volado';
  if (h.estado === 'lista') return 'programado';
  const conArea = !!(h.resumen || (h.area && (h.area.original || h.area.eje)));
  return conArea ? 'permisos' : 'planificacion';
}

/** Resumen corto que se guarda con la hoja (para listas y la ficha del proyecto). */
export function resumenHoja(hoja, d, geo) {
  const t = totales(hoja, d, geo);
  if (!t) return null;
  const largoLineal = geo.tipo === 'corredor' ? geo.sectores.reduce((s, x) => s + (x.largo || 0), 0) : (hoja.area.ejeCalc && hoja.area.ejeCalc.linea ? hoja.area.ejeCalc.largo : 0);
  const [lon, lat] = geo.marco.aLonLat([0, 0]);
  return { area: geo.areaVuelo, gsd: hoja.params.modo === 'lidar' ? null : t.gsd, altura: t.altura, vuelos: t.baterias, minTotal: t.minJornada, fotos: t.fotos, sectores: geo.sectores.length, corredor: geo.tipo === 'corredor', modo: hoja.params.modo, densidad: t.sectores[0] ? t.sectores[0].densidad : null, largo: largoLineal || 0, centro: [Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5] };
}

// ─────────── Jornadas necesarias (v0.10) ───────────
export const HORARIO_INICIAL = { inicio: '08:30', fin: '17:30', pausa: 60, traslado: 0 };
const aMin = hhmm => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
/** Minutos útiles de vuelo por día según el horario de la hoja. */
export function minutosUtiles(horario) {
  const h = { ...HORARIO_INICIAL, ...(horario || {}) };
  const a = aMin(h.inicio), b = aMin(h.fin);
  return a == null || b == null || b <= a ? 0 : Math.max(0, b - a - (Number(h.pausa) || 0));
}

/**
 * Reparte los sectores (en su orden, que en un área lineal es el sentido del eje) en jornadas que caben en el horario.
 * Cada jornada toma sectores completos; entre sectores del mismo día suma el traslado (min). Un sector que no cabe
 * en un día queda solo y marcado «excede». Devuelve { util, dias: [{ sectores: [i], min, baterias, excede }] } o null.
 */
export function jornadasNecesarias(hoja, d, g, t = null) {
  if (!g || !d) return null;
  const tot = t || totales(hoja, d, g);
  if (!tot) return null;
  const h = { ...HORARIO_INICIAL, ...(hoja.params.horario || {}) };
  const util = minutosUtiles(h), traslado = Number(h.traslado) || 0;
  if (!util) return { util: 0, dias: [] };
  const dias = [];
  let dia = null;
  tot.sectores.forEach((r, i) => {
    if (!r) return;
    const costo = r.minTotal + (dia && dia.sectores.length ? traslado : 0);
    if (!dia || (dia.sectores.length && dia.min + costo > util)) { dia = { sectores: [], min: 0, baterias: 0, excede: false }; dias.push(dia); }
    dia.min += dia.sectores.length ? costo : r.minTotal;
    dia.baterias += r.vuelos;
    dia.sectores.push(i);
    if (dia.min > util) dia.excede = true;
  });
  return { util, dias };
}
