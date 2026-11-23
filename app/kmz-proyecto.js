// app/kmz-proyecto.js — carpetas KMZ de cada parte del proyecto (Sistema v0.21; era la v0.18b planificada).
// Cada botón exporta solo lo suyo (red de PR, marcas GCP, vuelo, monografías) y «Exportar el proyecto» junta todo
// en carpetas. Aquí solo se arman las carpetas (sin pantalla ni base de datos: se prueba en node);
// la lectura de los datos y la descarga están en app/exportar-kmz.js.

import { geometria, nombreSector } from '../modulos/vuelos/hoja.js';
import { estadoSectores, totalesAvance } from '../modulos/vuelos/avance.js';
import { prsActivos } from '../modulos/vuelos/capas-proyecto.js';

const f1 = x => Number(x || 0).toLocaleString('es-CL', { maximumFractionDigits: 1 });
const f2 = x => Number(x || 0).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const llValido = p => p && p.lon != null && p.lat != null && p.lon !== '' && p.lat !== '' && Number.isFinite(Number(p.lon)) && Number.isFinite(Number(p.lat));

export const COLORES = {
  area: '#F4D35E', camino: '#FFFFFF', prExistente: '#FDD835', prNuevo: '#E53935', control: '#1E88E5', vector: '#00BCD4',
  gcp: '#FB8C00', chequeo: '#1E88E5', vueloArea: '#00BCD4', sectorListo: '#43A047', sectorParcial: '#FFB300', sectorFalta: '#9E9E9E',
  base: '#E53935', monografia: '#E53935',
};

// ─────────── Capas del proyecto (KMZ cargado): área, caminos y PR existentes ───────────
export function carpetaCapas(capas = {}) {
  const areas = (capas.areas || []).map(a => ({ tipo: 'poligono', nombre: a.nombre || 'Área de trabajo', coords: a.anillo, datos: { 'Superficie (ha)': a.ha != null ? f1(a.ha) : '' }, estilo: { color: COLORES.area, relleno: 0.12, ancho: 2 } }));
  const caminos = (capas.caminos || []).map((c, i) => ({ tipo: 'linea', nombre: c.nombre || `Camino ${i + 1}`, coords: c.linea, estilo: { color: COLORES.camino, ancho: 2 } }));
  const prs = prsActivos(capas).filter(llValido).map(p => ({ tipo: 'punto', nombre: p.nombre || 'PR', coords: [p.lon, p.lat], estilo: { color: COLORES.prExistente, icono: 'triangulo' } }));
  return { nombre: 'Capas del proyecto', carpetas: [
    { nombre: 'Área de trabajo', elementos: areas },
    { nombre: 'Caminos', elementos: caminos },
    { nombre: 'PR existentes', elementos: prs },
  ] };
}

// ─────────── Red de PR (planificación) ───────────
export function carpetaRed(red = {}) {
  const pts = (red.puntos || []).filter(llValido);
  const porId = new Map(pts.map(p => [p.id, p]));
  const punto = p => ({ tipo: 'punto', nombre: p.nombre || 'PR', coords: [p.lon, p.lat], descripcion: p.nota || '', datos: { Tipo: p.tipo === 'control' ? 'Punto de control (amarre)' : 'PR nuevo' },
    estilo: { color: p.tipo === 'control' ? COLORES.control : COLORES.prNuevo, icono: 'triangulo' } });
  const vectores = (red.vectores || []).map(([a, b]) => [porId.get(a), porId.get(b)]).filter(([a, b]) => a && b)
    .map(([a, b]) => ({ tipo: 'linea', nombre: `${a.nombre} – ${b.nombre}`, coords: [[a.lon, a.lat], [b.lon, b.lat]], estilo: { color: COLORES.vector, ancho: 1.5 } }));
  const area = red.area && red.area.length >= 3 ? [{ tipo: 'poligono', nombre: red.areaNombre || 'Área de la red', coords: red.area, estilo: { color: COLORES.area, relleno: 0, ancho: 2 } }] : [];
  return { nombre: `Red de PR · ${red.nombre || 'Red'}`, carpetas: [
    { nombre: 'PR nuevos', elementos: pts.filter(p => p.tipo !== 'control').map(punto) },
    { nombre: 'Puntos de control', elementos: pts.filter(p => p.tipo === 'control').map(punto) },
    { nombre: 'Vectores', elementos: vectores },
    { nombre: 'Área', elementos: area },
  ] };
}

// ─────────── Marcas de vuelo (GCP) ───────────
export function carpetaMarcas(m = {}) {
  const ms = (m.marcas || []).filter(llValido);
  const marca = x => ({ tipo: 'punto', nombre: x.nombre || '', coords: [x.lon, x.lat], datos: { Tipo: x.tipo === 'control' ? 'Control (GCP)' : 'Chequeo' },
    estilo: { color: x.tipo === 'control' ? COLORES.gcp : COLORES.chequeo, icono: 'cruz' } });
  const geo = m.modo === 'corredor'
    ? (m.eje && m.eje.length >= 2 ? [{ tipo: 'linea', nombre: 'Eje', coords: m.eje, estilo: { color: COLORES.gcp, ancho: 2 } }] : [])
    : (m.area && m.area.length >= 3 ? [{ tipo: 'poligono', nombre: 'Área de las marcas', coords: m.area, estilo: { color: COLORES.gcp, relleno: 0, ancho: 2 } }] : []);
  return { nombre: `Marcas de vuelo · ${m.nombre || 'GCP'}`, carpetas: [
    { nombre: 'Control (GCP)', elementos: ms.filter(x => x.tipo === 'control').map(marca) },
    { nombre: 'Chequeo', elementos: ms.filter(x => x.tipo !== 'control').map(marca) },
    { nombre: m.modo === 'corredor' ? 'Eje' : 'Área', elementos: geo },
  ] };
}

// ─────────── Vuelo (hoja): sectores con hectáreas y avance, base usada y su altura ───────────
/**
 * hoja: la hoja de vuelo · avance: registros de vuelos_avance de la hoja · amarre: resultado de calcularAmarreHoja o null.
 * Cada sector lleva su superficie, el % completado, la base usada (la del último registro) con su altura y la base
 * planificada. El vuelo dice además su altura de vuelo, GSD y el avance total.
 */
export function carpetaVuelo(hoja, { avance = [], amarre = null, geo = null } = {}) {
  const g = geo || geometria(hoja);
  const r = hoja.resumen || {};
  const nombre = `Vuelo · ${hoja.nombre || 'Hoja de vuelo'}`;
  if (!g) return { nombre, carpetas: [] };
  const aLL = xy => g.marco.aLonLat(xy);
  const n = g.sectores.length;
  const lista = g.sectores.map((s, i) => ({ nombre: nombreSector(hoja, i, n), ha: Math.round((s.area || 0) / 100) / 100 }));
  const estado = estadoSectores(lista, avance);
  const tot = totalesAvance(estado);
  const basePlan = i => { const ps = amarre && amarre.porSector && amarre.porSector[i]; const b = ps && ps.base ? amarre.bases.find(x => x.id === ps.base) : null; return b ? b.nombre : ''; };
  const color = pct => (pct >= 100 ? COLORES.sectorListo : pct > 0 ? COLORES.sectorParcial : COLORES.sectorFalta);
  const sectores = g.sectores.map((s, i) => {
    const e = estado[i], u = e.ultimo || {};
    return {
      tipo: 'poligono', nombre: `${e.nombre} · ${f2(e.ha)} ha · ${e.pct} %`, coords: s.poligono.map(aLL),
      datos: {
        Sector: e.nombre, 'Superficie (ha)': f2(e.ha), 'Completado (%)': e.pct,
        'Base usada': u.base || '', 'Altura de la base (m)': u.alturaBase != null && u.alturaBase !== '' ? f2(u.alturaBase) : '',
        'Último vuelo': u.fecha || '', 'Base planificada': basePlan(i),
      },
      estilo: { color: color(e.pct), relleno: 0.3, ancho: 2 },
    };
  });
  // Bases: las usadas (por nombre, del avance) y las planificadas por el amarre.
  const usadas = new Map();
  for (const e of estado) for (const reg of e.registros) if (reg.base) {
    const k = String(reg.base).trim();
    const u = usadas.get(k) || { sectores: new Set(), altura: '' };
    u.sectores.add(e.nombre); if (reg.alturaBase != null && reg.alturaBase !== '' && !u.altura) u.altura = f2(reg.alturaBase);
    usadas.set(k, u);
  }
  const conocidos = new Map(((amarre && amarre.todos) || []).map(p => [String(p.nombre).trim().toLowerCase(), p]));
  const bases = [];
  for (const b of ((amarre && amarre.bases) || [])) {
    const u = usadas.get(String(b.nombre).trim());
    bases.push({ tipo: 'punto', nombre: b.nombre, coords: b.ll, estilo: { color: COLORES.base, icono: 'banderita' },
      datos: { 'Sectores planificados': b.sectores.map(i => lista[i].nombre).join(', '), 'Usada en': u ? [...u.sectores].join(', ') : '', 'Altura de la base (m)': u ? u.altura : '', Nueva: b.nuevo ? 'Sí' : '' } });
  }
  for (const [k, u] of usadas) {
    if (((amarre && amarre.bases) || []).some(b => String(b.nombre).trim() === k)) continue;
    const p = conocidos.get(k.toLowerCase());
    if (!p) continue; // base registrada por nombre que no está en las capas: queda en los datos del sector
    bases.push({ tipo: 'punto', nombre: k, coords: [p.lon, p.lat], estilo: { color: COLORES.base, icono: 'banderita' },
      datos: { 'Usada en': [...u.sectores].join(', '), 'Altura de la base (m)': u.altura } });
  }
  const area = [];
  if (g.original) area.push({ tipo: 'poligono', nombre: 'Área original', coords: g.original.map(aLL), estilo: { color: '#FFFFFF', relleno: 0, ancho: 2 } });
  if (g.tipo === 'corredor' && g.eje) area.push({ tipo: 'linea', nombre: 'Eje', coords: g.eje.map(aLL), estilo: { color: '#FFFFFF', ancho: 2 } });
  area.push({ tipo: 'poligono', nombre: 'Área de vuelo', coords: g.vuelo.map(aLL), estilo: { color: COLORES.vueloArea, relleno: 0.08, ancho: 2 } });
  const desc = [
    r.altura ? `Altura de vuelo: ${Math.round(r.altura)} m` : '',
    r.gsd ? `GSD: ${f1(r.gsd)} cm` : '',
    `Avance: ${tot.pct} % · ${f1(tot.volados)} de ${tot.sectores} sectores · ${f1(tot.haVoladas)} de ${f1(tot.ha)} ha`,
  ].filter(Boolean).join('\n');
  return { nombre, descripcion: desc, carpetas: [
    { nombre: `Sectores (${n}) · ${f1(tot.ha)} ha`, elementos: sectores, abierta: true },
    { nombre: 'Bases', elementos: bases },
    { nombre: 'Área', elementos: area },
  ] };
}

// ─────────── Monografías ───────────
/** puntos: [{ nombre, lat, lon, este, norte, cota, estado }] (ya con posición; ver modulos/monografias/mapa-calculo.js). */
export function carpetaMonografias(puntos = []) {
  return { nombre: 'Monografías', elementos: puntos.filter(llValido).map(p => ({
    tipo: 'punto', nombre: p.nombre || '', coords: [p.lon, p.lat],
    datos: { 'Este (m)': p.este ?? '', 'Norte (m)': p.norte ?? '', 'Cota (m)': p.cota ?? '', Estado: p.estado || '' },
    estilo: { color: COLORES.monografia, icono: 'triangulo' },
  })) };
}

/** Documento del proyecto completo: una carpeta por parte, solo las que tienen algo. */
export function documentoProyecto(proyecto, { redes = [], marcas = [], vuelos = [], monografias = [] } = {}) {
  const carpetas = [
    carpetaCapas(proyecto.capas || {}),
    ...(redes.length ? [{ nombre: 'Redes de PR', carpetas: redes.map(carpetaRed) }] : []),
    ...(marcas.length ? [{ nombre: 'Marcas de vuelo (GCP)', carpetas: marcas.map(carpetaMarcas) }] : []),
    ...(vuelos.length ? [{ nombre: 'Vuelos', carpetas: vuelos.map(v => carpetaVuelo(v.hoja, v)) }] : []),
    ...(monografias.length ? [carpetaMonografias(monografias)] : []),
  ];
  return { nombre: proyecto.nombre || 'Proyecto', descripcion: [proyecto.mandante ? `Mandante: ${proyecto.mandante}` : '', 'Exportado desde el Sistema de trabajo.'].filter(Boolean).join('\n'), carpetas };
}
