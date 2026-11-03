// compartido/periodicidad.js — periodicidad de un proyecto (único o recurrente) y sus ciclos (v0.10).
// Un proyecto recurrente (p. ej. SADDN, mensual) repite: terreno N días hábiles → llegada de datos → entrega en N días hábiles.
// Fechas como texto local AAAA-MM-DD (sin desfase de zona horaria). Días hábiles = lunes a viernes (los feriados no se descuentan).
//
// proyecto.periodicidad = {
//   tipo: 'unico' | 'recurrente',
//   cada: 1, unidad: 'mes' | 'semana',
//   semana: 'primera' | 'segunda' | 'tercera' | 'cuarta' | 'ultima'   (mensual: semana del mes en que parte el terreno, lunes)
//   desde: 'AAAA-MM' (mensual) | 'AAAA-MM-DD' (semanal: lunes de la primera salida),
//   mesInicial: 1        (N° de mes del contrato del primer ciclo: carpeta 001, 012…)
//   diasTerreno: 4, datos: 'lunes' | 'siguiente' | 'mismo', diasEntrega: 5, hasta: '' | 'AAAA-MM-DD'
// }

export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const SEMANAS = [['primera', 'primera semana'], ['segunda', 'segunda semana'], ['tercera', 'tercera semana'], ['cuarta', 'cuarta semana'], ['ultima', 'última semana completa']];
export const DATOS = [['lunes', 'el lunes siguiente'], ['siguiente', 'el día hábil siguiente'], ['mismo', 'el último día de terreno']];

export const BASE_RECURRENTE = { tipo: 'recurrente', cada: 1, unidad: 'mes', semana: 'ultima', desde: '', mesInicial: 1, diasTerreno: 4, datos: 'lunes', diasEntrega: 5, hasta: '' };

const aFecha = iso => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1, 12); };
export const aISO = f => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
const habil = f => f.getDay() !== 0 && f.getDay() !== 6;
export function sumarDias(iso, n) { const f = aFecha(iso); f.setDate(f.getDate() + n); return aISO(f); }
/** Suma n días hábiles (sin contar el día de partida). */
export function sumarHabiles(iso, n) { const f = aFecha(iso); let k = 0; while (k < n) { f.setDate(f.getDate() + 1); if (habil(f)) k++; } return aISO(f); }
/** Resta n días hábiles. */
export function restarHabiles(iso, n) { const f = aFecha(iso); let k = 0; while (k < n) { f.setDate(f.getDate() - 1); if (habil(f)) k++; } return aISO(f); }
/** Los primeros n días hábiles desde iso (incluido si es hábil). */
export function diasHabilesDesde(iso, n) {
  const out = [], f = aFecha(iso);
  while (!habil(f)) f.setDate(f.getDate() + 1);
  while (out.length < n) { if (habil(f)) out.push(aISO(f)); f.setDate(f.getDate() + 1); }
  return out;
}
export const nombreMes = (y, m) => `${MESES[m]} ${y}`;

/** Lunes en que parte el terreno de un mes (y, m: 0–11) según la semana elegida. */
export function lunesDelMes(y, m, semana, diasTerreno = 4) {
  const lunes = [];
  for (let d = 1; d <= 31; d++) { const f = new Date(y, m, d, 12); if (f.getMonth() !== m) break; if (f.getDay() === 1) lunes.push(f); }
  const k = { primera: 0, segunda: 1, tercera: 2, cuarta: 3 }[semana];
  if (k != null) return aISO(lunes[Math.min(k, lunes.length - 1)]);
  // Última semana completa: el último lunes cuyo terreno termina dentro del mes.
  for (let i = lunes.length - 1; i >= 0; i--) { const dias = diasHabilesDesde(aISO(lunes[i]), Math.max(1, diasTerreno)); if (aFecha(dias[dias.length - 1]).getMonth() === m) return aISO(lunes[i]); }
  return aISO(lunes[0]);
}

function fechasDelCiclo(p, inicio) {
  const terreno = diasHabilesDesde(inicio, Math.max(1, Number(p.diasTerreno) || 1));
  const fin = terreno[terreno.length - 1];
  const datos = p.datos === 'mismo' ? fin : p.datos === 'siguiente' ? sumarHabiles(fin, 1) : (() => { const f = aFecha(fin); do { f.setDate(f.getDate() + 1); } while (f.getDay() !== 1); return aISO(f); })();
  return { terreno: [terreno[0], fin], diasTerreno: terreno, datos, entrega: sumarHabiles(datos, Math.max(0, Number(p.diasEntrega) || 0)) };
}

/**
 * Ciclos de un proyecto recurrente cuyo terreno o entrega cae entre desde y hasta (AAAA-MM-DD).
 * Devuelve [{ n, numero: '013', nombre: 'Noviembre 2026', carpeta: '013 Noviembre', terreno: [ini, fin], diasTerreno, datos, entrega }].
 */
export function ciclosEntre(per, desde, hasta) {
  const p = { ...BASE_RECURRENTE, ...(per || {}) };
  if (p.tipo !== 'recurrente' || !p.desde) return [];
  const cada = Math.max(1, Number(p.cada) || 1), out = [];
  for (let k = 0; k < 600; k++) {
    let inicio, nombre;
    if (p.unidad === 'semana') {
      const f = aFecha(p.desde); while (f.getDay() !== 1) f.setDate(f.getDate() - 1); f.setDate(f.getDate() + 7 * cada * k);
      inicio = aISO(f); nombre = `Semana del ${f.getDate()} de ${MESES[f.getMonth()].toLowerCase()}`;
    } else {
      const [y0, m0] = p.desde.split('-').map(Number), t = (m0 - 1) + cada * k, y = y0 + Math.floor(t / 12), m = t % 12;
      inicio = lunesDelMes(y, m, p.semana, p.diasTerreno); nombre = nombreMes(y, m);
    }
    if (p.hasta && inicio > p.hasta) break;
    const c = fechasDelCiclo(p, inicio);
    if (c.terreno[0] > hasta) break;
    const n = (Number(p.mesInicial) || 1) + k, numero = String(n).padStart(3, '0');
    if (c.entrega >= desde) out.push({ n, numero, nombre, carpeta: `${numero} ${nombre.split(' ')[0]}`, ...c });
  }
  return out;
}

/** El ciclo cuyo terreno parte en el mes de la fecha dada (para crear el mes en Seguimiento), o el siguiente. */
export function cicloDelMes(per, iso) {
  const d = aFecha(iso), ini = aISO(new Date(d.getFullYear(), d.getMonth(), 1, 12)), fin = aISO(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12));
  return ciclosEntre(per, ini, sumarDias(fin, 60)).find(c => c.terreno[0] >= ini) || null;
}

/** Texto corto de la periodicidad: «Recurrente · cada mes · terreno 4 días · entrega 5 días hábiles». */
export function textoPeriodicidad(per) {
  if (!per || per.tipo !== 'recurrente') return 'Único';
  const p = { ...BASE_RECURRENTE, ...per };
  const cada = Number(p.cada) > 1 ? `cada ${p.cada} ${p.unidad === 'semana' ? 'semanas' : 'meses'}` : p.unidad === 'semana' ? 'semanal' : 'mensual';
  return `Recurrente · ${cada} · terreno ${p.diasTerreno} día${Number(p.diasTerreno) === 1 ? '' : 's'} · entrega ${p.diasEntrega} días hábiles después de los datos`;
}
