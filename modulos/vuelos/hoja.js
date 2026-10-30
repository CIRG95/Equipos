// modulos/vuelos/hoja.js — la hoja de vuelo: modelo de datos, migración y cálculos (área, sectores, vuelo).
// Sin pantalla: las funciones reciben la hoja y devuelven resultados.

import { hoyISO } from '../../compartido/util.js';
import { proyectar, calcularPlan, alturaParaGsd, gsdCm, areaM2 } from './calculo.js';
import { margenPoligono, aplicarCortes, cortarEje, poligonoCorredor, largo } from './geom.js';

const R_LAT = 110540, R_LON = 111320;

export const PARAMS_INICIALES = {
  modo: 'foto', porGsd: true, gsd: 2.5, altura: 100, traslapeFrontal: 80, traslapeLateral: 70,
  velocidad: '', exposicion: 1000, reserva: 25, minDespegue: 3, minCambio: 5, segGiro: 8,
};

export const DOCUMENTOS_DGAC = [
  ['kmz', 'KMZ de la zona'], ['carta', 'Carta o autorización del mandante'], ['seguro', 'Seguro aprobado por la JAC'],
  ['credencial', 'Credencial del piloto vigente'], ['inscripcion', 'Inscripción del dron'],
];
export const CONSULTAS = [
  ['notam', 'NOTAM en AIP Chile', 'https://aipchile.dgac.gob.cl/notam'],
  ['aip', 'Mapa interactivo AIP Chile', 'https://aipchile.dgac.gob.cl/'],
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
    permisos: { dgac: { preparado: '', enviado: '', aprobado: '', vence: '', numero: '' }, docs: {}, consultas: [] },
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
  const clave = JSON.stringify([a.tipo, fuente.length, fuente[0], fuente[fuente.length - 1], a.margen, a.rectas, a.corredor, a.cortes]);
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
    valor = { marco, tipo: 'corredor', eje, izq, der, vuelo: poligonoCorredor(eje, izq, der), original: null, sectores, fallidos: cortes.length && tramos.length < cortes.length + 1 ? ['algún corte no cruza el eje'] : [] };
  } else {
    const original = fuente.map(marco.aXY);
    const vuelo = Number(a.margen) > 0 ? margenPoligono(original, Number(a.margen), { rectas: a.rectas !== false }) : original;
    const { sectores, fallidos } = aplicarCortes(vuelo, cortes);
    valor = { marco, tipo: 'poligono', original, vuelo, sectores: sectores.map(p => ({ poligono: p, area: areaM2(p) })), fallidos };
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
  return total > 1 ? `S${i + 1}` : 'Área completa';
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
  const despegue = meta.despegue ? geo.marco.aXY(meta.despegue) : centroide(sec.poligono);
  const b = baseCalculo(hoja, d, { ...geomSector, despegue, ...extra });
  const P = hoja.params;
  if (extra.velocidad) return { ...calcularPlan(b), velocidad: extra.velocidad, despegueXY: despegue, altura: b.altura, modo: b.modo };
  const previo = calcularPlan({ ...b, velocidad: 10 });
  const sugerida = Math.floor(previo.velSugerida * 10) / 10;
  const velocidad = Number(P.velocidad) || sugerida;
  return { ...calcularPlan({ ...b, velocidad }), velocidad, sugerida, auto: !Number(P.velocidad), despegueXY: despegue, modo: b.modo, altura: b.altura };
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

/** Resumen corto que se guarda con la hoja (para listas y la ficha del proyecto). */
export function resumenHoja(hoja, d, geo) {
  const t = totales(hoja, d, geo);
  if (!t) return null;
  return { area: geo.areaVuelo, gsd: hoja.params.modo === 'lidar' ? null : t.gsd, altura: t.altura, vuelos: t.baterias, minTotal: t.minJornada, fotos: t.fotos, sectores: geo.sectores.length, corredor: geo.tipo === 'corredor', modo: hoja.params.modo, densidad: t.sectores[0] ? t.sectores[0].densidad : null };
}
