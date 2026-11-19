// app/trabajos.js — trabajos del proyecto y su orden (Sistema v0.17). Reglas puras; pruebas en pruebas/trabajos.test.mjs.
//
// Un proyecto con varios tipos de trabajo los ordena para armar el cronograma de terreno:
//   p.trabajos = [{ cat, dias, paralelo }]   (en el orden de ejecución)
// · Los trabajos de vuelo se planifican por baterías (la hoja de vuelo da las jornadas); los demás (GNSS, estación total,
//   nivelación, escaneo, batimetría) por horario de trabajo, en días.
// · «paralelo» = se hace en las mismas jornadas que el trabajo anterior (p. ej. GNSS estático mientras se vuela).
// · Orden sugerido: primero la red GNSS (los vuelos se amarran a sus PR), luego vuelos y después el resto.

export const ORDEN_SUGERIDO = ['gnss', 'nivelacion', 'dron', 'estacion', 'escaneo', 'batimetria', 'otro'];
export const POR_BATERIAS = new Set(['dron']);
const DIAS_INICIALES = { gnss: 2, nivelacion: 2, dron: 2, estacion: 3, escaneo: 2, batimetria: 2, otro: 2 };

/** Trabajos del proyecto en su orden: respeta lo guardado y suma al final los tipos nuevos (sin los que ya no están). */
export function trabajosDeProyecto(p = {}) {
  const tipos = (p.tiposTrabajo || []).filter(Boolean);
  const guardados = (p.trabajos || []).filter(t => tipos.includes(t.cat));
  const faltan = tipos.filter(c => !guardados.some(t => t.cat === c)).sort((a, b) => ORDEN_SUGERIDO.indexOf(a) - ORDEN_SUGERIDO.indexOf(b));
  return [...guardados, ...faltan.map(cat => ({ cat, dias: DIAS_INICIALES[cat] || 2, paralelo: false }))].map((t, k) => ({ ...t, paralelo: k === 0 ? false : !!t.paralelo }));
}

const siguienteHabil = iso => { const f = new Date(`${iso}T12:00:00`); do f.setDate(f.getDate() + 1); while ([0, 6].includes(f.getDay())); return f.toISOString().slice(0, 10); };
const habil = iso => { const f = new Date(`${iso}T12:00:00`); while ([0, 6].includes(f.getDay())) f.setDate(f.getDate() + 1); return f.toISOString().slice(0, 10); };
/** Último día hábil de un trabajo de n días hábiles que empieza en `desde`. */
export function finDeTrabajo(desde, n) { let d = habil(desde); for (let k = 1; k < Math.max(1, Math.round(n)); k++) d = siguienteHabil(d); return d; }

/**
 * Cronograma de terreno a partir de los trabajos ordenados.
 *   diasDe(t) → días del trabajo (por defecto t.dias; para vuelos, las jornadas de la hoja si existen)
 *   nombre(cat) → nombre del tipo de trabajo
 * Devuelve [{ id, nombre, desde, hasta, origen: 'trabajos', cat }]. Si hay plazo y queda tiempo, suma «Gabinete y entrega».
 */
export function cronogramaDeTrabajos(trabajos, desde, { diasDe = t => t.dias, nombre = c => c, plazo = '' } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(desde || '')) || !trabajos.length) return [];
  const out = [];
  let inicio = habil(desde), prev = null;
  for (const t of trabajos) {
    const n = Math.max(1, Math.round(Number(diasDe(t)) || 1));
    const ini = t.paralelo && prev ? prev.desde : inicio;
    const fin = finDeTrabajo(ini, n);
    const act = { id: `t-${t.cat}`, nombre: `${nombre(t.cat)} en terreno${POR_BATERIAS.has(t.cat) ? ' (por baterías)' : ''}${t.paralelo ? ' · en paralelo' : ''}`, desde: ini, hasta: fin, origen: 'trabajos', cat: t.cat, responsableId: null, hecho: false };
    out.push(act);
    const finGrupo = out.reduce((m, a) => (a.hasta > m ? a.hasta : m), fin);
    inicio = siguienteHabil(finGrupo);
    prev = t.paralelo && prev ? { desde: prev.desde } : { desde: ini };
  }
  const ultimo = out.reduce((m, a) => (a.hasta > m ? a.hasta : m), out[0].hasta);
  if (plazo && plazo > ultimo) out.push({ id: 't-gabinete', nombre: 'Gabinete y entrega', desde: siguienteHabil(ultimo), hasta: plazo, origen: 'trabajos', cat: 'gabinete', responsableId: null, hecho: false });
  return out;
}

/** Avisos del orden (no bloquean): vuelos amarrados a PR nuevos antes de la red GNSS. */
export function avisosOrden(trabajos, { prsNuevos = 0 } = {}) {
  const i = c => trabajos.findIndex(t => t.cat === c);
  const avisos = [];
  if (prsNuevos > 0) {
    if (i('gnss') < 0) avisos.push(`Los vuelos necesitan ${prsNuevos} PR nuevo${prsNuevos === 1 ? '' : 's'}, pero el proyecto no tiene un trabajo GNSS para instalarlos y medirlos.`);
    else if (i('dron') >= 0 && i('dron') < i('gnss')) avisos.push(`Los vuelos van antes que la red GNSS, pero ${prsNuevos === 1 ? 'un PR nuevo se debe' : `${prsNuevos} PR nuevos se deben`} instalar y medir antes de volar.`);
    else if (i('dron') >= 0 && trabajos[i('dron')].paralelo && i('dron') === i('gnss') + 1) avisos.push('Los vuelos van en paralelo con la red GNSS: confirme que los PR nuevos queden medidos antes del vuelo de su sector.');
  }
  return avisos;
}

/** Mueve un trabajo de la posición a la posición b (arrastrar o flechas). */
export function moverTrabajo(trabajos, a, b) {
  const t = trabajos.slice();
  if (a < 0 || a >= t.length || b < 0 || b >= t.length) return t;
  const [x] = t.splice(a, 1);
  t.splice(b, 0, x);
  return t.map((x2, k) => ({ ...x2, paralelo: k === 0 ? false : x2.paralelo }));
}

/**
 * v0.18 · Cronograma automático: las actividades ya realizadas se conservan y las pendientes se reemplazan por las de
 * los trabajos ordenados. Devuelve { cronograma, cambio } (cambio = hay que guardarlo).
 */
export function cronogramaSincronizado(previas = [], nuevo = []) {
  if (!nuevo.length) return { cronograma: previas, cambio: false };
  const hechas = previas.filter(a => a.hecho);
  const ids = new Set(hechas.map(a => a.id));
  const cronograma = [...hechas, ...nuevo.filter(n => !ids.has(n.id))];
  const firma = l => JSON.stringify(l.map(a => [a.id, a.nombre, a.desde, a.hasta, !!a.hecho]));
  return { cronograma, cambio: firma(cronograma) !== firma(previas) };
}
