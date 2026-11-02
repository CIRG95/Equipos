// modulos/vuelos/cortes.js — forma del área (eje automático de un área lineal) y cortes automáticos por método (v0.8).
// Métodos: área lineal (usa el eje) → distancia · superficie · dm · tramos; cualquier área → n (paralelos con rotación) ·
// baterias · dias; manual = trazar a mano. Todos devuelven cortes en lon/lat que quedan en h.area.cortes como los manuales.

import { geometria, marcoDe, distanciasCorte, distanciasPorBaterias, calcularSector } from './hoja.js';
import { ejeDePoligono, esAreaLineal, cortesTransversales, cortesParalelos, rumboLadoLargo, distanciasPorSuperficie, largo, anchoEn } from './geom.js';

export const METODOS = {
  distancia: { texto: 'Por distancia', grupo: 'lineal', ayuda: 'Cortes perpendiculares al eje cada X m o km, desde el inicio del eje.' },
  superficie: { texto: 'Por superficie', grupo: 'lineal', ayuda: 'Cortes perpendiculares al eje para que cada sector tenga la superficie indicada.' },
  dm: { texto: 'Alineados al DM', grupo: 'lineal', ayuda: 'Cortes en DM redondos (cada 1 km: 11+000, 12+000…) o desde un primer DM. Necesita el DM del inicio del eje (pestaña Forma).' },
  tramos: { texto: 'Tramos del Seguimiento', grupo: 'lineal', ayuda: 'Corta en los DM de inicio y fin de los tramos del Seguimiento del proyecto de la hoja. Necesita el DM del inicio del eje.' },
  n: { texto: 'En N sectores', grupo: 'todas', ayuda: 'Cortes rectos y paralelos, con la dirección que elijas, que dividen el área en N sectores de igual superficie (o igual distancia).' },
  baterias: { texto: 'Por baterías', grupo: 'todas', ayuda: 'Corta para que cada sector se vuele con esa cantidad de baterías o menos, con el despegue al centro del sector.' },
  dias: { texto: 'Por días de vuelo', grupo: 'todas', ayuda: 'Arma un sector por día según las horas de vuelo que tienes por día (incluye traslados y cambios de batería).' },
  manual: { texto: 'Manual', grupo: 'manual', ayuda: 'Traza el corte por un camino, quebrada o cerco: toca afuera del área, sigue el borde tocando puntos y termina afuera.' },
};

/** Forma del área: para un polígono calcula (y guarda en la hoja) su eje si es lineal. Devuelve { lineal, corredor, largo, anchoMin, anchoProm, anchoMax } o null. */
export function formaDe(hoja) {
  const a = hoja.area, g = geometria(hoja);
  if (!g) return null;
  if (g.tipo === 'corredor') {
    const ancho = g.izq + g.der, L = largo(g.eje);
    return { lineal: true, corredor: true, largo: L, anchoMin: ancho, anchoProm: ancho, anchoMax: ancho };
  }
  const clave = JSON.stringify([a.original && a.original.anillo.length, a.original && a.original.anillo[0], a.margen, a.rectas]);
  if (!a.ejeCalc || a.ejeCalc.clave !== clave) {
    const e = ejeDePoligono(g.vuelo);
    a.ejeCalc = e && esAreaLineal(e) ? {
      clave, linea: e.eje.map(g.marco.aLonLat), largo: e.largo, anchoMin: e.anchoMin, anchoProm: e.anchoProm, anchoMax: e.anchoMax,
      perfil: e.anchos.filter((_, k, arr) => k % Math.max(1, Math.ceil(arr.length / 400)) === 0 || k === arr.length - 1).map(p => [Math.round(p.s * 10) / 10, Math.round(p.ancho * 10) / 10]),
    } : { clave, linea: null };
  }
  const c = a.ejeCalc;
  return c.linea ? { lineal: true, corredor: false, largo: c.largo, anchoMin: c.anchoMin, anchoProm: c.anchoProm, anchoMax: c.anchoMax } : { lineal: false, corredor: false };
}

/** Método que la app propone según la forma. */
export const metodoPropuesto = forma => (forma && forma.lineal ? 'distancia' : 'n');

/** Eje en metros (marco de la geometría) con su perfil de anchos. */
function ejeDe(hoja, g) {
  const a = hoja.area;
  if (g.tipo === 'corredor') {
    const eje = a.eje.linea.map(g.marco.aXY), L = largo(eje), ancho = g.izq + g.der;
    return { eje, L, perfil: [{ s: 0, ancho }, { s: L, ancho }], semi: () => Math.max(g.izq, g.der) + 40, izq: g.izq, der: g.der };
  }
  if (!a.ejeCalc || !a.ejeCalc.linea) return null;
  const eje = a.ejeCalc.linea.map(g.marco.aXY), L = largo(eje);
  const perfil = a.ejeCalc.perfil.map(([s, ancho]) => ({ s: s * L / (a.ejeCalc.largo || L), ancho }));
  const medio = a.ejeCalc.anchoProm / 2;
  return { eje, L, perfil, semi: s => anchoEn(perfil, s) * 0.6 + 30, izq: medio, der: medio };
}

/** Rumbo propuesto para los cortes paralelos: perpendicular al lado más largo del área. */
export function rumboCortesPropuesto(hoja) {
  const g = geometria(hoja);
  return g ? (rumboLadoLargo(g.vuelo) + 90) % 180 : 0;
}

const metros = (v, u) => Number(String(v).replace(',', '.')) * (u === 'km' ? 1000 : 1);
const m2De = (v, u) => Number(String(v).replace(',', '.')) * (u === 'km2' ? 1e6 : 1e4);

/** Distancias de corte sobre el eje para los métodos lineales. */
function distanciasLineales(hoja, e, au, extra) {
  const dm = hoja.area.dm || {};
  if (au.modo === 'distancia') return distanciasCorte(e.L, { modo: 'inicio', cada: metros(au.cada || 5, au.unidad || 'km') });
  if (au.modo === 'superficie') return distanciasPorSuperficie(e.perfil, e.L, m2De(au.sup || 50, au.unidadSup || 'ha'));
  if (au.modo === 'dm') return distanciasCorte(e.L, { modo: 'dm', cada: metros(au.cada || 1, au.unidad || 'km'), dmInicio: dm.inicio, desc: !!dm.desc, primerDM: extra.primerDM });
  if (au.modo === 'tramos') return distanciasCorte(e.L, { modo: 'tramos', dmInicio: dm.inicio, desc: !!dm.desc, tramosKm: extra.tramosKm || [] });
  return [];
}

function cortesEnDistancias(g, e, distancias) {
  return distancias.flatMap(s => cortesTransversales(e.eje, [s], e.semi(s))).map(c => c.map(g.marco.aLonLat));
}

/** Vista previa barata (sin calcular vuelos): { sectores, haPorSector } o null si el método se calcula al generar. */
export function vistaPrevia(hoja) {
  const g = geometria(hoja), au = hoja.area.auto || {};
  if (!g) return null;
  const modo = au.modo === 'inicio' ? 'distancia' : (au.modo || metodoPropuesto(formaDe(hoja)));
  if (modo === 'n') { const n = Math.max(2, Math.min(60, Number(au.n) || 4)); return { sectores: n, haPorSector: g.areaVuelo / n / 1e4 }; }
  if (!['distancia', 'superficie', 'dm', 'tramos'].includes(modo)) return null;
  formaDe(hoja);
  const e = ejeDe(hoja, g);
  if (!e) return null;
  if ((modo === 'dm' || modo === 'tramos') && (!hoja.area.dm || hoja.area.dm.inicio == null)) return null;
  if (modo === 'tramos') return null;
  const n = distanciasLineales(hoja, e, { ...au, modo }, { primerDM: au.primerKm ?? null }).length + 1;
  return { sectores: n, haPorSector: g.areaVuelo / n / 1e4 };
}

/**
 * Genera los cortes del método elegido (h.area.auto). extra: { tramosKm, primerDM, dron }.
 * Devuelve { cortes (lon/lat), nota } o lanza un Error con un mensaje para el usuario.
 */
export function generarCortes(hoja, extra = {}) {
  const g0 = geometria(hoja), au = hoja.area.auto || {};
  if (!g0) throw new Error('Primero carga o dibuja el área.');
  // Los cortes se calculan sobre el área sin cortes.
  const sinCortes = { ...hoja, area: { ...hoja.area, cortes: [], sectores: [] } };
  const g = geometria(sinCortes);
  const forma = formaDe(hoja);
  const modo = au.modo || metodoPropuesto(forma);
  const d = extra.dron;

  if (['distancia', 'superficie', 'dm', 'tramos'].includes(modo)) {
    const e = forma && forma.lineal ? ejeDe(hoja, g) : null;
    if (!e) throw new Error('Este método usa el eje del área y el área no es lineal. Usa «En N sectores».');
    if ((modo === 'dm' || modo === 'tramos') && (!hoja.area.dm || hoja.area.dm.inicio == null)) throw new Error('Escribe primero el DM del inicio del eje (pestaña Forma), por ejemplo 10+000.');
    const dist = distanciasLineales(hoja, e, au, extra);
    if (!dist.length) throw new Error(modo === 'tramos' ? 'Ningún DM de los tramos cae dentro del eje: revisa el DM del inicio y si baja.' : 'Con esos datos no hay cortes dentro del área.');
    return { cortes: cortesEnDistancias(g, e, dist) };
  }
  if (modo === 'n') {
    const n = Math.max(2, Math.min(60, Number(au.n) || 4));
    const rumbo = au.rumbo === '' || au.rumbo == null ? rumboCortesPropuesto(hoja) : Number(au.rumbo);
    if (g.tipo === 'corredor') { const e = ejeDe(hoja, g); return { cortes: cortesEnDistancias(g, e, Array.from({ length: n - 1 }, (_, k) => e.L * (k + 1) / n)) }; }
    return { cortes: cortesParalelos(g.vuelo, n, rumbo, { igualSuperficie: au.igual !== false }).map(c => c.map(g.marco.aLonLat)) };
  }
  if (modo === 'baterias') {
    if (!d) throw new Error('Elige el dron.');
    const n = Math.max(1, Number(au.bat) || 4);
    if (forma && forma.lineal) {
      const e = ejeDe(hoja, g);
      const dist = g.tipo === 'corredor' ? distanciasPorBaterias(sinCortes, d, n) : distanciasPorBaterias(sinCortes, d, n, { eje: e.eje, izq: e.izq, der: e.der });
      if (!dist.length) return { cortes: [], nota: `Toda el área se vuela con ${n} batería${n === 1 ? '' : 's'} o menos: no hace falta cortar.` };
      return { cortes: cortesEnDistancias(g, e, dist) };
    }
    // Área extensa: cuántos sectores paralelos hacen falta para que ninguno pase de n baterías.
    return buscarN(hoja, sinCortes, g, (r) => r.vuelos <= n, `Toda el área se vuela con ${n} batería${n === 1 ? '' : 's'} o menos: no hace falta cortar.`, d);
  }
  if (modo === 'dias') {
    if (!d) throw new Error('Elige el dron.');
    const horas = Number(String(au.horas || 6).replace(',', '.'));
    if (!(horas > 0)) throw new Error('Escribe las horas de vuelo por día.');
    return buscarN(hoja, sinCortes, g, (r) => r.minTotal <= horas * 60, 'Toda el área cabe en un día de vuelo: no hace falta cortar.', d);
  }
  throw new Error('Con el método manual se traza cada corte en el mapa («Trazar corte»).');
}

/** Busca el menor N (1–60) de sectores que cumple la condición en todos ellos. */
function buscarN(hoja, sinCortes, g, cumple, notaUno, d) {
  const forma = formaDe(hoja), au = hoja.area.auto || {};
  const e = forma && forma.lineal ? ejeDe(hoja, g) : null;
  const rumbo = au.rumbo === '' || au.rumbo == null ? rumboCortesPropuesto(hoja) : Number(au.rumbo);
  const cortesN = n => {
    if (n <= 1) return [];
    if (e) return cortesEnDistancias(g, e, Array.from({ length: n - 1 }, (_, k) => e.L * (k + 1) / n));
    return cortesParalelos(g.vuelo, n, rumbo, { igualSuperficie: true }).map(c => c.map(g.marco.aLonLat));
  };
  const ok = n => {
    const prueba = { ...sinCortes, area: { ...sinCortes.area, cortes: cortesN(n), sectores: [] } };
    const gp = geometria(prueba);
    if (!gp || gp.fallidos.length) return false;
    return gp.sectores.every((_, i) => { const r = calcularSector(prueba, d, gp, i); return r && cumple(r); });
  };
  if (ok(1)) return { cortes: [], nota: notaUno };
  let lo = 1, hi = 2;
  while (hi < 60 && !ok(hi)) { lo = hi; hi = Math.min(60, hi * 2); }
  while (hi - lo > 1) { const m = Math.floor((lo + hi) / 2); if (ok(m)) hi = m; else lo = m; }
  return { cortes: cortesN(hi), nota: hi >= 60 && !ok(60) ? 'Con 60 sectores todavía hay alguno que no cumple: revisa los datos.' : '' };
}

/** Convierte el área lineal en corredor sobre su eje calculado (ancho = mitad del ancho promedio a cada lado, redondeado). */
export function corredorDesdeEje(hoja) {
  const a = hoja.area, c = a.ejeCalc;
  if (!c || !c.linea) return false;
  const medio = Math.max(5, Math.round(c.anchoMax / 2));
  const L = c.largo;
  Object.assign(a, { tipo: 'corredor', eje: { nombre: `Eje de ${(a.original && a.original.nombre) || 'el área'}`, linea: c.linea, largo: L }, corredor: { izq: medio, der: medio, mismo: true }, cortes: [], sectores: [], sel: 0 });
  return true;
}
export { marcoDe };
