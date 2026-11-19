// modulos/vuelos/avance.js — v0.18a: avance de los vuelos por sector (sin pantalla ni base de datos; se prueba en node).
//
// Cada registro es un evento que solo se agrega (lo escribe el Sistema o la app de Terreno, sin pisarse):
//   { id, hojaId, proyectoId, sector: 'S3', fecha: 'AAAA-MM-DD', pct: 0–100, base, alturaBase, obs, personaId, origen, creadoEn }
// El estado de un sector es su último registro (por fecha y, en la misma fecha, por hora de registro).
// Los sectores de la hoja vienen de hoja.resumen.listaSectores [{ nombre, ha }].

export const PORCENTAJES = [25, 50, 75, 100];

const posterior = (a, b) => (a.fecha !== b.fecha ? a.fecha > b.fecha : String(a.creadoEn || '') > String(b.creadoEn || ''));
const r1 = x => Math.round(x * 10) / 10;

/** Estado de cada sector: [{ nombre, ha, pct, ultimo, registros }]. */
export function estadoSectores(sectores = [], eventos = []) {
  return sectores.map(s => {
    const regs = eventos.filter(e => e.sector === s.nombre && !e.eliminadoEn).sort((a, b) => (posterior(a, b) ? -1 : 1));
    const ultimo = regs[0] || null;
    return { nombre: s.nombre, ha: Number(s.ha) || 0, pct: ultimo ? Math.max(0, Math.min(100, Number(ultimo.pct) || 0)) : 0, ultimo, registros: regs };
  });
}

/** Totales: sectores volados (un sector al 50 % suma 0,5), hectáreas y % por superficie. */
export function totalesAvance(estado = []) {
  const n = estado.length;
  const volados = r1(estado.reduce((s, x) => s + x.pct / 100, 0));
  const ha = estado.reduce((s, x) => s + x.ha, 0);
  const haVoladas = estado.reduce((s, x) => s + (x.ha * x.pct) / 100, 0);
  const completos = estado.filter(x => x.pct >= 100).length;
  return { sectores: n, volados, completos, ha: r1(ha), haVoladas: r1(haVoladas), pct: ha ? Math.round((100 * haVoladas) / ha) : (n ? Math.round((100 * volados) / n) : 0), terminado: n > 0 && completos === n };
}

/**
 * Meta del día contra lo registrado, con el programa de la hoja (h.programa [{ fecha, dia, sectores: [nombres] }]).
 * Devuelve { hoy: { dia, sectores, listos } | null, atrasados: [nombres], cumplida: bool | null }.
 */
export function metaDelDia(programa = [], estado = [], hoy) {
  const pct = Object.fromEntries(estado.map(x => [x.nombre, x.pct]));
  const deHoy = programa.find(d => d.fecha === hoy) || null;
  const atrasados = [...new Set(programa.filter(d => d.fecha < hoy).flatMap(d => d.sectores || []))].filter(nm => (pct[nm] ?? 0) < 100);
  const listos = deHoy ? (deHoy.sectores || []).filter(nm => (pct[nm] ?? 0) >= 100) : [];
  return { hoy: deHoy ? { dia: deHoy.dia, sectores: deHoy.sectores || [], listos } : null, atrasados, cumplida: deHoy ? listos.length === (deHoy.sectores || []).length : null };
}

/** Texto corto: «2,5 de 8 sectores · 4.016 de 16.065 ha (25 %)». */
export function textoAvance(t) {
  if (!t || !t.sectores) return 'Sin sectores';
  const f = x => x.toLocaleString('es-CL', { maximumFractionDigits: 1 });
  return `${f(t.volados)} de ${t.sectores} sector${t.sectores === 1 ? '' : 'es'}${t.ha ? ` · ${f(t.haVoladas)} de ${f(t.ha)} ha (${t.pct} %)` : ''}`;
}

/** Valida un registro antes de guardarlo. Devuelve el texto del problema o ''. */
export function problemaRegistro(r = {}) {
  if (!r.hojaId) return 'Falta la hoja de vuelo.';
  if (!r.sector) return 'Elige el sector.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.fecha || ''))) return 'Indica la fecha del vuelo.';
  const p = Number(r.pct);
  if (!(p >= 0 && p <= 100)) return 'El porcentaje va de 0 a 100.';
  if (r.alturaBase !== '' && r.alturaBase != null && !(Number(r.alturaBase) >= 0 && Number(r.alturaBase) < 10)) return 'La altura de la base va en metros (entre 0 y 10).';
  return '';
}
