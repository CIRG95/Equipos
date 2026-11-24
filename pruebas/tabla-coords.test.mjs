// v0.21.3 · Tabla de coordenadas con columnas elegibles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { separar, detectarSeparador, numeroCon, pareceTitulos, detectarColumnas, registros, revisar, intercambiarEN, leerAuto } from '../modulos/monografias/tabla-coords.js';

test('separador: tabulación, punto y coma, coma y espacios', () => {
  assert.equal(detectarSeparador('PR-1\t352100,5\t6972345,25'), 'tab');
  assert.equal(detectarSeparador('PR-1;352100,5;6972345,25'), 'pyc');
  assert.equal(detectarSeparador('PR-1,352100.5,6972345.25,812.4\nPR-2,352200.1,6972400.2,815'), 'coma');
  assert.equal(detectarSeparador('PR-1 352100,5 6972345,25\nPR-2 352200,1 6972400,2'), 'espacio');
  assert.equal(detectarSeparador('PR-1   352100.5   6972345.25'), 'espacio');
});

test('decimales con punto o coma, automático o elegido', () => {
  assert.equal(numeroCon('352100.50'), 352100.5);
  assert.equal(numeroCon('352100,50'), 352100.5);
  assert.equal(numeroCon('6.972.345,25'), 6972345.25);
  assert.equal(numeroCon('6,972,345.25'), 6972345.25);
  assert.equal(numeroCon('352.100', 'coma'), 352100);
  assert.equal(numeroCon('352,100', 'punto'), 352100);
  assert.equal(numeroCon('12a'), null);
  assert.equal(numeroCon(''), null);
});

test('títulos y columnas por nombre de encabezado', () => {
  const { filas } = separar('Punto;Norte;Este;Cota\nM1;6201000;612000;100');
  assert.equal(pareceTitulos(filas), true);
  assert.deepEqual(detectarColumnas(filas, true), ['nombre', 'norte', 'este', 'cota']);
});

test('columnas por valores cuando no hay títulos (N antes que E, columna extra)', () => {
  const { filas } = separar('PR-1\tHito\t6972345,25\t352100,5\t812,4\nPR-2\tHito\t6972400\t352200\t815');
  assert.equal(pareceTitulos(filas), false);
  const roles = detectarColumnas(filas, false);
  assert.deepEqual(roles, ['nombre', 'no', 'norte', 'este', 'cota']);
  const r = registros(filas, roles, {});
  assert.equal(r[0].este, 352100.5); assert.equal(r[0].norte, 6972345.25); assert.equal(r[0].cota, 812.4);
});

test('revisión: invertidos, no número, repetidos, faltan columnas', () => {
  const { filas } = separar('PR-1\t6972345\t352100\nPR-1\t6972400\tx');
  let roles = ['nombre', 'este', 'norte'];
  let rev = revisar(registros(filas, roles), roles);
  assert.ok(rev.avisos.some(a => a.tipo === 'invertidos'));
  assert.ok(rev.avisos.some(a => /no son número/.test(a.texto)));
  assert.ok(rev.avisos.some(a => /repetidos/.test(a.texto)));
  assert.equal(rev.puedeCrear, false);
  roles = intercambiarEN(roles);
  assert.deepEqual(roles, ['nombre', 'norte', 'este']);
  assert.equal(revisar([], ['nombre']).puedeCrear, false);
  const ok = separar('PR-1\t352100\t6972345\nPR-2\t352200\t6972400').filas;
  assert.equal(revisar(registros(ok, ['nombre', 'este', 'norte']), ['nombre', 'este', 'norte']).puedeCrear, true);
});

test('lectura automática igual que antes', () => {
  const r = leerAuto('PR-1\t352100,5\t6972345,25\t812,4\nPR-2\t352200\t6972400\t815');
  assert.equal(r.length, 2); assert.equal(r[1].nombre, 'PR-2'); assert.equal(r[0].cota, 812.4);
});
