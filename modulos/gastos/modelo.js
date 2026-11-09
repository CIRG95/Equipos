// modulos/gastos/modelo.js — reglas del módulo Gastos, sin navegador ni base de datos (se prueban con node --test).
//
// Conceptos (decididos por Camilo, 29-oct y 9-nov-2026):
//   · Gasto: boleta (o «sin boleta» con motivo), fecha, comercio, monto CLP, categoría, proyecto (u «Oficina»), persona, nota.
//   · Cuenta = persona × proyecto. Los gastos no enviados de una cuenta SON el borrador (no se arma a mano).
//   · Rendición: se crea al enviar; lleva N° por persona. Estados: Borrador → Enviada → Pagada, y Devuelta.
//     El estado sale siempre del último evento (enviada / devuelta / pagada); los eventos nunca se editan.
//   · Fondo por rendir: RRHH registra depósitos (antes o después de gastar). Cada rendición muestra
//     fondo, gastado y saldo: a favor de la persona → RRHH lo paga; a favor de la empresa → la persona lo
//     devuelve (reintegro) o pasa a la siguiente rendición. Sin fondo = reembolso puro.

export const CATEGORIAS = ['Combustible', 'Alimentación', 'Alojamiento', 'Peajes', 'Movilización', 'Materiales', 'Otros'];

export const ESTADOS = {
  borrador: { texto: 'Borrador', color: 'gris' },
  enviada: { texto: 'Enviada', color: 'azul' },
  devuelta: { texto: 'Devuelta', color: 'ambar' },
  pagada: { texto: 'Pagada', color: 'verde' },
};
const TIPOS_ESTADO = ['enviada', 'devuelta', 'pagada'];

const vivo = r => r && !r.eliminadoEn;
const cronologico = (a, b) => (a.creadoEn || '').localeCompare(b.creadoEn || '') || (a.orden || 0) - (b.orden || 0);

// ───────── Montos ─────────

/** «$ 62.000», «62000», «62.000,4» → 62000 (entero en pesos). Vacío o inválido → null. */
export function leerMonto(texto) {
  if (typeof texto === 'number') return Number.isFinite(texto) ? Math.round(texto) : null;
  const t = String(texto ?? '').replace(/[^\d,]/g, '');
  if (!t) return null;
  const [ent, dec] = t.split(',');
  const n = Number(ent || '0') + (dec ? Number('0.' + dec) : 0);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** 186450 → «$ 186.450»; negativos con signo. */
export function clp(n) {
  const v = Math.round(Number(n) || 0);
  const s = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${v < 0 ? '−' : ''}$ ${s}`;
}

export const suma = gastos => gastos.reduce((t, g) => t + (Number(g.monto) || 0), 0);

// ───────── Gastos ─────────

/** Gastos de la misma persona con el mismo monto y fecha (posible boleta repetida). */
export function posiblesDuplicados(gasto, existentes) {
  return existentes.filter(g => vivo(g) && g.id !== gasto.id && g.personaId === gasto.personaId
    && g.fecha === gasto.fecha && Number(g.monto) === Number(gasto.monto));
}

/** Revisa un gasto antes de guardarlo. Devuelve la lista de problemas (vacía = se puede guardar). */
export function problemasGasto(g) {
  const p = [];
  if (!(Number(g.monto) > 0)) p.push('Falta el monto.');
  if (!CATEGORIAS.includes(g.categoria)) p.push('Elige una categoría.');
  if (!g.fecha) p.push('Falta la fecha.');
  if (!g.proyectoId) p.push('Elige el proyecto (u «Oficina»).');
  if (!g.personaId) p.push('Elige quién eres arriba (persona).');
  if (g.sinBoleta ? !String(g.motivoSinBoleta || '').trim() : !g.archivoId && !g.tieneBoletaNueva) p.push('Agrega la foto de la boleta o marca «No tengo boleta» con el motivo.');
  return p;
}

// ───────── Rendiciones y eventos ─────────

export const eventosDe = (eventos, rendicionId) => eventos.filter(e => vivo(e) && e.rendicionId === rendicionId).sort(cronologico);

/** Estado de una rendición desde sus eventos (el último de enviada / devuelta / pagada). Sin eventos = borrador. */
export function estadoRendicion(eventosR) {
  const ult = eventosR.filter(e => TIPOS_ESTADO.includes(e.tipo)).sort(cronologico).pop();
  return ult ? ult.tipo : 'borrador';
}

export function ultimo(eventosR, tipo) { return eventosR.filter(e => e.tipo === tipo).sort(cronologico).pop() || null; }

/** Se puede editar o borrar un gasto si no está en una rendición, o si su rendición fue devuelta. */
export function gastoEditable(gasto, estadoDeSuRendicion) {
  return !gasto.rendicionId || estadoDeSuRendicion === 'devuelta' || estadoDeSuRendicion === 'borrador';
}

/** N° siguiente de rendición para una persona (1, 2, 3…). */
export function numeroSiguiente(rendiciones, personaId) {
  return rendiciones.filter(r => r.personaId === personaId).reduce((m, r) => Math.max(m, Number(r.numero) || 0), 0) + 1;
}

/**
 * Libro de una cuenta (persona × proyecto): fondo, gastado y saldo de cada rendición y del borrador.
 * Depósitos: los que RRHH registra en una rendición quedan en ella; los registrados «a la cuenta» (sin rendición)
 * van a la primera rendición enviada en o después de la fecha del depósito que no estuviera pagada cuando se
 * registró el depósito; si no hay, al borrador. El saldo pasa a la siguiente rendición:
 *   · rendición pagada: saldo + pagado − reintegro (normalmente 0);
 *   · aún sin pagar: solo el saldo a favor de la empresa (lo que la persona tiene en mano); lo que la empresa
 *     debe se paga en esa misma rendición y no se descuenta de la siguiente.
 * Saldo > 0 = a favor de la empresa; saldo < 0 = a favor de la persona.
 */
export function libroCuenta({ rendiciones, gastos, eventos, personaId, proyectoId }) {
  const rs = rendiciones.filter(r => vivo(r) && r.personaId === personaId && r.proyectoId === proyectoId)
    .sort((a, b) => (a.numero || 0) - (b.numero || 0));
  const gs = gastos.filter(g => vivo(g) && g.personaId === personaId && g.proyectoId === proyectoId);
  const deps = eventos.filter(e => vivo(e) && e.tipo === 'deposito' && e.personaId === personaId && e.proyectoId === proyectoId).sort(cronologico);

  const info = rs.map(r => {
    const ev = eventosDe(eventos, r.id);
    const env = ev.find(e => e.tipo === 'enviada');
    return { r, ev, estado: estadoRendicion(ev), envio: env ? (env.fecha || env.creadoEn.slice(0, 10)) : null, pago: ultimo(ev, 'pagada') };
  });
  const asignados = new Map(info.map(x => [x.r.id, []]));
  const delBorrador = [];
  for (const d of deps) {
    if (d.rendicionId && asignados.has(d.rendicionId)) { asignados.get(d.rendicionId).push(d); continue; }
    const destino = info.find(x => x.envio && x.envio >= (d.fecha || '') && !(x.pago && (x.pago.creadoEn || '') < (d.creadoEn || '')));
    (destino ? asignados.get(destino.r.id) : delBorrador).push(d);
  }

  let arrastre = 0;
  const filas = {};
  for (const x of info) {
    const depositos = suma(asignados.get(x.r.id));
    const gastado = suma(gs.filter(g => g.rendicionId === x.r.id));
    const fondo = arrastre + depositos;
    const saldo = fondo - gastado;
    const pagado = x.pago ? Number(x.pago.monto) || 0 : 0;
    const reintegro = x.pago ? Number(x.pago.reintegro) || 0 : 0;
    const despues = x.estado === 'pagada' ? saldo + pagado - reintegro : Math.max(0, saldo);
    filas[x.r.id] = { rendicion: x.r, estado: x.estado, envio: x.envio, anterior: arrastre, depositos, listaDepositos: asignados.get(x.r.id), fondo, gastado, saldo, pagado, reintegro, arrastra: despues };
    arrastre = despues;
  }
  const gastosBorrador = gs.filter(g => !g.rendicionId);
  const depB = suma(delBorrador);
  const gastadoB = suma(gastosBorrador);
  const borrador = { anterior: arrastre, depositos: depB, listaDepositos: delBorrador, fondo: arrastre + depB, gastado: gastadoB, saldo: arrastre + depB - gastadoB, gastos: gastosBorrador };
  return { filas, borrador, totalDepositos: suma(deps), totalGastado: suma(gs) };
}

/** Qué hacer con el saldo al cerrar: pagar a la persona o pedir reintegro. */
export function sugerenciaCierre(saldo) {
  if (saldo < 0) return { tipo: 'pagar', monto: -saldo, texto: `Saldo a favor de la persona: ${clp(-saldo)}` };
  if (saldo > 0) return { tipo: 'empresa', monto: saldo, texto: `Saldo a favor de la empresa: ${clp(saldo)}` };
  return { tipo: 'cero', monto: 0, texto: 'Sin saldo: lo gastado es igual al fondo.' };
}

// ───────── Avisos (campanita) ─────────

/**
 * Avisos de Gastos para quien mira: terreno ve sus rendiciones devueltas o pagadas; RRHH, las enviadas por revisar.
 * Cada aviso es el último evento de estado de la rendición (su id sirve para marcar «visto»).
 */
export function avisosGastos({ rol, personaId, rendiciones, eventos }) {
  const salida = [];
  for (const r of rendiciones.filter(vivo)) {
    if (rol !== 'rrhh' && r.personaId !== personaId) continue;
    const ult = eventosDe(eventos, r.id).filter(e => TIPOS_ESTADO.includes(e.tipo)).pop();
    if (!ult) continue;
    if (rol === 'rrhh' ? ult.tipo === 'enviada' : ult.tipo === 'devuelta' || ult.tipo === 'pagada') salida.push({ id: ult.id, tipo: ult.tipo, rendicion: r, evento: ult });
  }
  return salida.sort((a, b) => (b.evento.creadoEn || '').localeCompare(a.evento.creadoEn || ''));
}

// ───────── Resúmenes ─────────

/** Resumen de un proyecto para su ficha: cantidad por estado, totales y lo pendiente de pago. */
export function resumenProyecto({ proyectoId, rendiciones, gastos, eventos }) {
  const rs = rendiciones.filter(r => vivo(r) && r.proyectoId === proyectoId);
  const gs = gastos.filter(g => vivo(g) && g.proyectoId === proyectoId);
  const porEstado = { borrador: 0, enviada: 0, devuelta: 0, pagada: 0 };
  let porPagar = 0;
  const personas = new Set([...rs.map(r => r.personaId), ...gs.map(g => g.personaId)]);
  for (const pid of personas) {
    const libro = libroCuenta({ rendiciones, gastos, eventos, personaId: pid, proyectoId });
    for (const f of Object.values(libro.filas)) {
      porEstado[f.estado]++;
      if (f.estado === 'enviada' && f.saldo < 0) porPagar += -f.saldo;
    }
    if (libro.borrador.gastos.length) porEstado.borrador++;
  }
  const depositos = suma(eventos.filter(e => vivo(e) && e.tipo === 'deposito' && e.proyectoId === proyectoId));
  return { porEstado, gastado: suma(gs), enRendiciones: suma(gs.filter(g => g.rendicionId)), sinEnviar: suma(gs.filter(g => !g.rendicionId)), depositos, porPagar, gastos: gs.length };
}

/** Totales por categoría (para el resumen de una rendición y el Excel). */
export function porCategoria(gastos) {
  const t = Object.fromEntries(CATEGORIAS.map(c => [c, 0]));
  for (const g of gastos) t[g.categoria] = (t[g.categoria] || 0) + (Number(g.monto) || 0);
  return CATEGORIAS.map(c => [c, t[c]]).filter(([, v]) => v);
}

export const ordenGastos = (a, b) => (a.fecha || '').localeCompare(b.fecha || '') || (a.creadoEn || '').localeCompare(b.creadoEn || '');
