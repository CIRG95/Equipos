// v0.21.1 · Copia de las preferencias de una instalación anterior a las claves nuevas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrarClavesAnteriores, BD_ANTERIOR } from '../compartido/nombres-anteriores.js';

const memoria = (ini = {}) => { const m = new Map(Object.entries(ini)); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };

test('copia las claves antiguas que faltan y no pisa las nuevas', () => {
  const ls = memoria({ [`${BD_ANTERIOR}_nube`]: '{"carpetaId":"c1"}', [`${BD_ANTERIOR}_dispositivoId`]: 'viejo', sistema_dispositivoId: 'nuevo', [`${BD_ANTERIOR}_conexion_persona`]: '{"id":"p2"}' });
  assert.equal(migrarClavesAnteriores(ls), 2);
  assert.equal(ls.getItem('sistema_nube'), '{"carpetaId":"c1"}');
  assert.equal(ls.getItem('sistema_dispositivoId'), 'nuevo');
  assert.equal(ls.getItem('sistema_conexion_persona'), '{"id":"p2"}');
  assert.equal(ls.getItem(`${BD_ANTERIOR}_nube`), '{"carpetaId":"c1"}', 'la antigua queda para la app sin actualizar');
});

test('una segunda vez no cambia nada', () => {
  const ls = memoria({ [`${BD_ANTERIOR}_nube_token`]: 't' });
  assert.equal(migrarClavesAnteriores(ls), 1);
  assert.equal(migrarClavesAnteriores(ls), 0);
});

test('sin almacenamiento no falla', () => { assert.equal(migrarClavesAnteriores(null), 0); });
