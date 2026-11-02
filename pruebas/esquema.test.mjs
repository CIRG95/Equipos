import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ESQUEMA } from '../compartido/esquema.js';
import { definicionesRegistradas, registrarAlmacenes } from '../compartido/almacen.js';
import '../compartido/catalogos.js';
import '../compartido/archivos.js';
import * as Equipos from '../modulos/equipos/datos.js';
import * as Vuelos from '../modulos/vuelos/datos.js';
import * as Seguimiento from '../modulos/seguimiento/datos.js';
import * as Mono from '../modulos/monografias/datos.js';

const normal = defs => Object.fromEntries(defs.map(d => [d.nombre, (d.indices || []).map(([n, r]) => `${n}=${JSON.stringify(r)}`).sort()]));

test('el esquema común trae todo lo que registran los módulos (nada fuera del esquema)', () => {
  const antes = normal(definicionesRegistradas());
  assert.deepEqual(antes, normal(ESQUEMA), 'almacen.js registra el esquema completo al cargarse');
  for (const m of [Equipos, Vuelos, Seguimiento, Mono]) {
    const f = m.iniciarDatos || m.iniciar;
    if (typeof f === 'function') f({ personaId: null });
  }
  assert.deepEqual(normal(definicionesRegistradas()), normal(ESQUEMA),
    'un módulo registró un almacén o índice que no está en compartido/esquema.js: agréguelo allí');
});

test('un índice nuevo de un módulo se suma al almacén ya registrado', () => {
  registrarAlmacenes([{ nombre: 'vuelos_drones', indices: [['prueba', 'prueba']] }]);
  const d = definicionesRegistradas().find(x => x.nombre === 'vuelos_drones');
  assert.deepEqual(d.indices, [['prueba', 'prueba']]);
});

test('sin nombres repetidos en el esquema', () => {
  assert.equal(new Set(ESQUEMA.map(d => d.nombre)).size, ESQUEMA.length);
});
