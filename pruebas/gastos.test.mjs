// pruebas/gastos.test.mjs — reglas del módulo Gastos (sin navegador): montos, estados, fondo por rendir y avisos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  leerMonto, clp, posiblesDuplicados, problemasGasto, estadoRendicion, eventosDe, gastoEditable, numeroSiguiente,
  libroCuenta, sugerenciaCierre, avisosGastos, resumenProyecto, porCategoria,
} from '../modulos/gastos/modelo.js';

let k = 0; let reloj = 0;
const id = p => `${p}${++k}`;
const t = () => `2026-11-0${Math.min(9, 1 + Math.floor(reloj / 10))}T10:00:${String(reloj++ % 60).padStart(2, '0')}Z`;
const P = 'p1', PE = 'camilo';

function libroDe(d) { return libroCuenta({ ...d, personaId: PE, proyectoId: P }); }
function nuevoMundo() { return { gastos: [], rendiciones: [], eventos: [] }; }
const gasto = (d, monto, fecha = '2026-11-03', extra = {}) => { const g = { id: id('g'), personaId: PE, proyectoId: P, monto, fecha, categoria: 'Combustible', rendicionId: null, creadoEn: t(), ...extra }; d.gastos.push(g); return g; };
const deposito = (d, monto, fecha, rendicionId = null) => d.eventos.push({ id: id('e'), tipo: 'deposito', personaId: PE, proyectoId: P, monto, fecha, rendicionId, creadoEn: t() });
function enviar(d, fecha = '2026-11-05', r = null) {
  if (!r) { r = { id: id('r'), numero: numeroSiguiente(d.rendiciones, PE), personaId: PE, proyectoId: P, creadoEn: t() }; d.rendiciones.push(r); }
  for (const g of d.gastos) if (!g.rendicionId && g.personaId === PE && g.proyectoId === P) g.rendicionId = r.id;
  d.eventos.push({ id: id('e'), tipo: 'enviada', rendicionId: r.id, personaId: PE, proyectoId: P, fecha, creadoEn: t() });
  return r;
}
const pagar = (d, r, monto, reintegro = 0) => d.eventos.push({ id: id('e'), tipo: 'pagada', rendicionId: r.id, personaId: PE, proyectoId: P, fecha: '2026-11-08', monto, reintegro, creadoEn: t() });
const devolver = (d, r, motivo, observados = []) => d.eventos.push({ id: id('e'), tipo: 'devuelta', rendicionId: r.id, personaId: PE, proyectoId: P, motivo, observados, creadoEn: t() });

test('montos en pesos chilenos', () => {
  assert.equal(leerMonto('$ 62.000'), 62000);
  assert.equal(leerMonto('186450'), 186450);
  assert.equal(leerMonto('1.234,6'), 1235);
  assert.equal(leerMonto(''), null);
  assert.equal(clp(186450), '$ 186.450');
  assert.equal(clp(-36450), '−$ 36.450');
  assert.equal(clp(0), '$ 0');
});

test('gasto válido: boleta o «sin boleta» con motivo', () => {
  const base = { monto: 3450, categoria: 'Peajes', fecha: '2026-11-03', proyectoId: P, personaId: PE };
  assert.equal(problemasGasto({ ...base, sinBoleta: true, motivoSinBoleta: 'Peaje con TAG' }).length, 0);
  assert.equal(problemasGasto({ ...base, sinBoleta: true, motivoSinBoleta: '  ' }).length, 1);
  assert.equal(problemasGasto({ ...base, tieneBoletaNueva: true }).length, 0);
  assert.equal(problemasGasto({ ...base, archivoId: 'a1' }).length, 0);
  assert.ok(problemasGasto({ ...base, categoria: 'Fiesta', monto: 0, tieneBoletaNueva: true }).length === 2);
});

test('aviso de posible duplicado: misma persona, monto y fecha', () => {
  const d = nuevoMundo();
  gasto(d, 62000, '2026-11-03');
  gasto(d, 62000, '2026-11-04');
  gasto(d, 62000, '2026-11-03', { personaId: 'otra' });
  gasto(d, 62000, '2026-11-03', { eliminadoEn: '2026-11-05' });
  assert.equal(posiblesDuplicados({ personaId: PE, monto: 62000, fecha: '2026-11-03' }, d.gastos).length, 1);
  assert.equal(posiblesDuplicados({ id: d.gastos[0].id, personaId: PE, monto: 62000, fecha: '2026-11-03' }, d.gastos).length, 0);
});

test('estados: Borrador → Enviada → Devuelta → Enviada → Pagada (el último evento manda)', () => {
  const d = nuevoMundo();
  gasto(d, 10000);
  const r = enviar(d);
  assert.equal(estadoRendicion(eventosDe(d.eventos, r.id)), 'enviada');
  deposito(d, 5000, '2026-11-06', r.id); // un depósito no cambia el estado
  assert.equal(estadoRendicion(eventosDe(d.eventos, r.id)), 'enviada');
  devolver(d, r, 'Falta la boleta del hostal');
  assert.equal(estadoRendicion(eventosDe(d.eventos, r.id)), 'devuelta');
  assert.ok(gastoEditable(d.gastos[0], 'devuelta'));
  assert.ok(!gastoEditable(d.gastos[0], 'enviada'));
  enviar(d, '2026-11-07', r);
  pagar(d, r, 5000);
  assert.equal(estadoRendicion(eventosDe(d.eventos, r.id)), 'pagada');
  assert.equal(estadoRendicion([]), 'borrador');
});

test('N° de rendición por persona', () => {
  const rs = [{ personaId: PE, numero: 1 }, { personaId: PE, numero: 3 }, { personaId: 'otra', numero: 7 }];
  assert.equal(numeroSiguiente(rs, PE), 4);
  assert.equal(numeroSiguiente(rs, 'nueva'), 1);
});

test('fondo depositado ANTES de gastar: saldo a favor de la persona (boceto: 150.000 − 186.450)', () => {
  const d = nuevoMundo();
  deposito(d, 150000, '2026-11-01');
  [62000, 3450, 96000, 25000].forEach(m => gasto(d, m));
  let b = libroDe(d).borrador;
  assert.equal(b.fondo, 150000); assert.equal(b.gastado, 186450); assert.equal(b.saldo, -36450);
  const r = enviar(d);
  const f = libroDe(d).filas[r.id];
  assert.equal(f.fondo, 150000); assert.equal(f.saldo, -36450);
  assert.deepEqual(sugerenciaCierre(f.saldo), { tipo: 'pagar', monto: 36450, texto: 'Saldo a favor de la persona: $ 36.450' });
  pagar(d, r, 36450);
  b = libroDe(d).borrador;
  assert.equal(libroDe(d).filas[r.id].arrastra, 0);
  assert.equal(b.anterior, 0); assert.equal(b.fondo, 0);
});

test('fondo depositado DESPUÉS de gastar (con la rendición ya enviada) y sin fondo = reembolso puro', () => {
  const d = nuevoMundo();
  gasto(d, 230000);
  const r = enviar(d, '2026-11-06');
  assert.equal(libroDe(d).filas[r.id].saldo, -230000); // sin fondo: todo es reembolso
  deposito(d, 200000, '2026-11-07', r.id);             // RRHH registra el depósito en la rendición
  const f = libroDe(d).filas[r.id];
  assert.equal(f.fondo, 200000); assert.equal(f.saldo, -30000);
});

test('depósito registrado «a la cuenta» después de gastar va a la rendición enviada en o después de su fecha', () => {
  const d = nuevoMundo();
  gasto(d, 100000);
  const r = enviar(d, '2026-11-06');
  deposito(d, 80000, '2026-11-02'); // depositado antes del envío, registrado tarde
  assert.equal(libroDe(d).filas[r.id].fondo, 80000);
  deposito(d, 50000, '2026-11-08'); // posterior al envío: es para lo próximo (borrador)
  assert.equal(libroDe(d).filas[r.id].fondo, 80000);
  assert.equal(libroDe(d).borrador.fondo, 50000);
});

test('saldo a favor de la empresa: pasa a la siguiente rendición, o se devuelve (reintegro)', () => {
  const d = nuevoMundo();
  deposito(d, 200000, '2026-11-01');
  gasto(d, 150000);
  const r1 = enviar(d, '2026-11-04');
  assert.equal(libroDe(d).filas[r1.id].saldo, 50000);
  assert.equal(sugerenciaCierre(50000).tipo, 'empresa');
  // Aún sin cerrar: la persona tiene 50.000 en mano y se descuentan en el borrador
  gasto(d, 20000, '2026-11-06');
  assert.equal(libroDe(d).borrador.anterior, 50000);
  assert.equal(libroDe(d).borrador.saldo, 30000);
  // RRHH cierra «pasa a la siguiente» (sin movimiento de dinero): el arrastre se mantiene
  pagar(d, r1, 0, 0);
  assert.equal(libroDe(d).borrador.anterior, 50000);
  // Otro mundo: la persona devuelve los 50.000
  const d2 = nuevoMundo();
  deposito(d2, 200000, '2026-11-01'); gasto(d2, 150000);
  const s1 = enviar(d2, '2026-11-04');
  pagar(d2, s1, 0, 50000);
  assert.equal(libroDe(d2).filas[s1.id].arrastra, 0);
  assert.equal(libroDe(d2).borrador.anterior, 0);
});

test('lo que la empresa debe en una rendición sin pagar no se descuenta de la siguiente', () => {
  const d = nuevoMundo();
  gasto(d, 40000);
  const r1 = enviar(d, '2026-11-04');
  gasto(d, 10000, '2026-11-06');
  const lb = libroDe(d);
  assert.equal(lb.filas[r1.id].saldo, -40000);
  assert.equal(lb.borrador.anterior, 0);
  assert.equal(lb.borrador.saldo, -10000);
});

test('un depósito no se mueve de rendición después de pagada', () => {
  const d = nuevoMundo();
  deposito(d, 100000, '2026-11-01');
  gasto(d, 100000);
  const r1 = enviar(d, '2026-11-04');
  pagar(d, r1, 0);
  assert.equal(libroDe(d).filas[r1.id].fondo, 100000);
  deposito(d, 30000, '2026-11-02'); // registrado después del pago, con fecha anterior: no reabre r1
  assert.equal(libroDe(d).filas[r1.id].fondo, 100000);
  assert.equal(libroDe(d).borrador.fondo, 30000);
});

test('avisos: terreno ve devueltas y pagadas; RRHH, las enviadas por revisar', () => {
  const d = nuevoMundo();
  gasto(d, 1000); const r1 = enviar(d);
  gasto(d, 2000); const r2 = enviar(d); devolver(d, r2, 'Falta boleta');
  gasto(d, 3000); const r3 = enviar(d); pagar(d, r3, 3000);
  const rrhh = avisosGastos({ rol: 'rrhh', ...d });
  assert.deepEqual(rrhh.map(a => a.rendicion.id), [r1.id]);
  const terreno = avisosGastos({ rol: 'terreno', personaId: PE, ...d });
  assert.deepEqual(terreno.map(a => a.tipo).sort(), ['devuelta', 'pagada']);
  assert.equal(avisosGastos({ rol: 'terreno', personaId: 'otra', ...d }).length, 0);
});

test('resumen del proyecto para su ficha y totales por categoría', () => {
  const d = nuevoMundo();
  deposito(d, 50000, '2026-11-01');
  gasto(d, 30000); gasto(d, 40000, '2026-11-03', { categoria: 'Alojamiento' });
  const r = enviar(d);
  gasto(d, 5000, '2026-11-07');
  const res = resumenProyecto({ proyectoId: P, ...d });
  assert.equal(res.gastado, 75000); assert.equal(res.sinEnviar, 5000); assert.equal(res.depositos, 50000);
  assert.equal(res.porEstado.enviada, 1); assert.equal(res.porEstado.borrador, 1);
  assert.equal(res.porPagar, 20000);
  assert.deepEqual(porCategoria(d.gastos.filter(g => g.rendicionId === r.id)), [['Combustible', 30000], ['Alojamiento', 40000]]);
});
