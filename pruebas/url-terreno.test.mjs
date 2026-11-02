import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolverUrlTerreno } from '../app/url-terreno.js';

const SIS = 'https://cirg95.github.io/equipos/index.html#/personas';

test('sin dirección guardada usa terreno/ junto al Sistema', () => {
  assert.equal(resolverUrlTerreno('', SIS), 'https://cirg95.github.io/equipos/terreno/');
  assert.equal(resolverUrlTerreno(null, 'https://cirg95.github.io/equipos/'), 'https://cirg95.github.io/equipos/terreno/');
});

test('respeta una dirección escrita por la persona', () => {
  assert.equal(resolverUrlTerreno('https://otra.cl/terreno/', SIS), 'https://otra.cl/terreno/');
});

test('ignora la página de prueba antigua del paquete', () => {
  assert.equal(resolverUrlTerreno('https://cirg95.github.io/equipos/paquete-conexion/ejemplo.html', SIS), 'https://cirg95.github.io/equipos/terreno/');
});
