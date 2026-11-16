// compartido/cronograma.js — fechas del cronograma de un proyecto (Sistema v0.16). Reglas puras, sin base de datos:
// las usan el encargo (app/encargo.js) y la gestión de personal (Administración) para saber cuándo ocupa a su gente.
//   p.cronograma = [{ id, nombre, desde, hasta, responsableId, hecho }]   (fechas AAAA-MM-DD)

export const dia = iso => { const [y, m, d] = String(iso).split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000; };
export const isoDe = n => new Date(n * 86400000).toISOString().slice(0, 10);
export const esFecha = t => /^\d{4}-\d{2}-\d{2}$/.test(String(t || ''));

/** Rango total y avance del cronograma: { desde, hasta, dias, hechas, total, pct, atrasadas: [actividad] }. */
export function resumenCronograma(cronograma = [], hoy) {
  const acts = cronograma.filter(a => a && a.nombre && esFecha(a.desde) && esFecha(a.hasta));
  if (!acts.length) return { desde: null, hasta: null, dias: 0, hechas: 0, total: 0, pct: 0, atrasadas: [], actual: null };
  const desde = acts.reduce((m, a) => (a.desde < m ? a.desde : m), acts[0].desde);
  const hasta = acts.reduce((m, a) => (a.hasta > m ? a.hasta : m), acts[0].hasta);
  const hechas = acts.filter(a => a.hecho).length;
  return {
    desde, hasta, dias: dia(hasta) - dia(desde) + 1, hechas, total: acts.length, pct: Math.round(100 * hechas / acts.length),
    atrasadas: hoy ? acts.filter(a => !a.hecho && a.hasta < hoy) : [],
    actual: hoy ? acts.find(a => !a.hecho && a.desde <= hoy && hoy <= a.hasta) || null : null,
  };
}

/** Posición de una actividad dentro del rango, en porcentaje (para dibujar la barra): { izq, ancho }. */
export function barraActividad(a, desde, hasta) {
  const total = dia(hasta) - dia(desde) + 1;
  if (!(total > 0) || !esFecha(a.desde) || !esFecha(a.hasta)) return { izq: 0, ancho: 0 };
  const i = Math.max(0, dia(a.desde) - dia(desde)), f = Math.min(total, dia(a.hasta) - dia(desde) + 1);
  return { izq: 100 * i / total, ancho: Math.max(1.5, 100 * (f - i) / total) };
}

/** Fechas entre las que el proyecto ocupa a su gente: cronograma, o encargo → plazo. null si no hay fechas. */
export function rangoProyecto(p = {}) {
  const r = resumenCronograma(p.cronograma);
  if (r.desde) return { desde: r.desde, hasta: r.hasta };
  const desde = esFecha(p.fechaInicio) ? p.fechaInicio : esFecha(p.fechaEncargo) ? p.fechaEncargo : null;
  const hasta = esFecha(p.plazo) ? p.plazo : null;
  if (!desde && !hasta) return null;
  return { desde: desde || hasta, hasta: hasta || '9999-12-31' };
}
export const seCruzan = (a, b) => !!a && !!b && a.desde <= b.hasta && b.desde <= a.hasta;

/** Personas del proyecto (encargado + cuadrilla), sin repetir. */
export const genteDeProyecto = p => [...new Set([p.encargadoId, ...(p.cuadrilla || [])].filter(Boolean))];
