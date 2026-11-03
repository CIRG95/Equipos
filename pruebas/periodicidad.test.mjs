// pruebas/periodicidad.test.mjs — ciclos de proyectos recurrentes (v0.10).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ciclosEntre, cicloDelMes, lunesDelMes, sumarHabiles, restarHabiles, diasHabilesDesde, textoPeriodicidad } from '../compartido/periodicidad.js';

const saddn = { tipo: 'recurrente', cada: 1, unidad: 'mes', semana: 'ultima', desde: '2025-10', mesInicial: 1, diasTerreno: 4, datos: 'lunes', diasEntrega: 5 };

test('días hábiles', () => {
  assert.equal(sumarHabiles('2026-11-02', 5), '2026-11-09');
  assert.equal(restarHabiles('2026-11-16', 7), '2026-11-05');
  assert.deepEqual(diasHabilesDesde('2026-11-07', 3), ['2026-11-09', '2026-11-10', '2026-11-11']);
});

test('última semana completa del mes', () => {
  assert.equal(lunesDelMes(2026, 9, 'ultima', 4), '2026-10-26');  // oct: 26–29
  assert.equal(lunesDelMes(2026, 10, 'ultima', 4), '2026-11-23'); // nov: el 30 no cabe
  assert.equal(lunesDelMes(2026, 10, 'primera', 4), '2026-11-02');
});

test('ciclos mensuales del SADDN', () => {
  const c = ciclosEntre(saddn, '2026-10-01', '2026-12-31');
  const oct = c.find(x => x.nombre === 'Octubre 2026');
  assert.deepEqual(oct.terreno, ['2026-10-26', '2026-10-29']);
  assert.equal(oct.datos, '2026-11-02');
  assert.equal(oct.entrega, '2026-11-09');
  assert.equal(oct.numero, '013');
  assert.equal(oct.carpeta, '013 Octubre');
  const nov = c.find(x => x.nombre === 'Noviembre 2026');
  assert.deepEqual(nov.terreno, ['2026-11-23', '2026-11-26']);
  assert.equal(nov.datos, '2026-11-30');
  assert.equal(cicloDelMes(saddn, '2026-11-15').nombre, 'Noviembre 2026');
});

test('semanal, hasta y único', () => {
  const s = ciclosEntre({ tipo: 'recurrente', unidad: 'semana', cada: 2, desde: '2026-11-04', diasTerreno: 1, datos: 'mismo', diasEntrega: 2 }, '2026-11-01', '2026-11-30');
  assert.deepEqual(s.map(x => x.terreno[0]), ['2026-11-02', '2026-11-16', '2026-11-30']);
  assert.equal(ciclosEntre({ ...saddn, hasta: '2026-01-31' }, '2026-03-01', '2026-12-31').length, 0);
  assert.equal(ciclosEntre({ tipo: 'unico' }, '2026-01-01', '2026-12-31').length, 0);
  assert.match(textoPeriodicidad(saddn), /mensual/);
});
