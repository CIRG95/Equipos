// pruebas/cortes-cerrados.test.mjs — cortes por polígonos cerrados y cortes de vértice a vértice (v0.11).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cortesCerrados, rectangularidad, prolongarCorte } from '../modulos/vuelos/cerrados.js';
import { aplicarCortes, areaFirmada } from '../modulos/vuelos/geom.js';

const area = p => Math.abs(areaFirmada(p));
const L = [[0, 0], [1000, 0], [1000, 400], [400, 400], [400, 1200], [0, 1200]];

test('una L se parte en dos rectángulos desde su vértice cóncavo', () => {
  const c = cortesCerrados(L);
  assert.equal(c.length, 1);
  const r = aplicarCortes(L, c.map(x => prolongarCorte(x, L)));
  assert.deepEqual(r.fallidos, []);
  assert.equal(r.sectores.length, 2);
  for (const s of r.sectores) assert.ok(rectangularidad(s) > 0.99);
  assert.ok(Math.abs(r.sectores.reduce((t, s) => t + area(s), 0) - area(L)) < 1);
});

test('un rectángulo no se corta', () => {
  assert.equal(cortesCerrados([[0, 0], [800, 0], [800, 300], [0, 300]]).length, 0);
});

test('corte manual de vértice a vértice (sin salir del área)', () => {
  const cuadrado = [[0, 0], [100, 0], [100, 100], [0, 100]];
  const r = aplicarCortes(cuadrado, [prolongarCorte([[0, 0], [100, 100]], cuadrado)]);
  assert.equal(r.sectores.length, 2);
  assert.ok(Math.abs(area(r.sectores[0]) - 5000) < 1);
});
