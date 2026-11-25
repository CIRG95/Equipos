import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarComun } from '../modulos/monografias/comun.js';

test('el encuadre común se conserva al normalizar los datos comunes', () => {
  const cfg = { centro: [-5.1, -81.1], zoom: 15, ancho: 640, alto: 400, estilo: { simbolo: 'triangulo' } };
  assert.deepEqual(normalizarComun({ croquisComun: cfg }).croquisComun, cfg);
});
test('un encuadre incompleto se descarta', () => {
  assert.equal(normalizarComun({ croquisComun: { zoom: 3 } }).croquisComun, null);
  assert.equal(normalizarComun({}).croquisComun, null);
});
