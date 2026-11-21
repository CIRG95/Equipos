// v0.20 · Checklist de terreno desde el Sistema (datos ficticios).
import test from 'node:test';
import assert from 'node:assert/strict';
import { PLANTILLAS_BASE, configEfectiva, plantillasDeTrabajos, instrumentosDeTrabajos, problemaPlantilla } from '../compartido/plantillas-terreno.js';

test('configEfectiva: sin nada guardado usa la base; lo guardado manda', () => {
  const b = configEfectiva(null);
  assert.equal(b.plantillas.length, 10); assert.equal(b.desdeSistema, false); assert.deepEqual(b.tolerancia, { verdeMm: 2, amarilloMm: 10 });
  assert.match(b.catastro, /^Poste:/);
  const g = configEfectiva({ plantillas: [{ id: 'aer', nombre: 'Vuelo', items: [{ id: 'a', texto: 'Base', tipo: 'check' }] }], tolerancia: { verdeMm: 3 } });
  assert.equal(g.plantillas.length, 1); assert.equal(g.desdeSistema, true); assert.deepEqual(g.tolerancia, { verdeMm: 3, amarilloMm: 10 });
  b.plantillas[0].nombre = 'x'; assert.notEqual(PLANTILLAS_BASE[0].nombre, 'x', 'devuelve una copia');
});

test('plantillasDeTrabajos: el detalle manda sobre la categoría y no se repiten', () => {
  const ids = t => plantillasDeTrabajos(t).map(p => p.id);
  assert.deepEqual(ids({ categorias: ['dron', 'gnss'], detalles: ['dron:aerofoto', 'gnss:red'] }), ['aer', 'red']);
  assert.deepEqual(ids({ categorias: ['dron', 'nivelacion'], detalles: ['dron:lidar'] }), ['lid', 'niv']);
  assert.deepEqual(ids({ categorias: ['estacion'], detalles: ['estacion:levantamiento', 'estacion:poligonal', 'estacion:replanteo'] }), ['est', 'rep']);
  assert.deepEqual(ids({ categorias: ['dron', 'otro'], detalles: ['dron:termografia', 'otro:gpr'] }), []);
  assert.deepEqual(ids({}), []);
});

test('instrumentosDeTrabajos y problemaPlantilla', () => {
  assert.deepEqual(instrumentosDeTrabajos({ categorias: ['nivelacion', 'estacion', 'dron'], detalles: ['estacion:catastro'] }), ['nivel', 'estacion', 'catastro']);
  assert.deepEqual(instrumentosDeTrabajos({ categorias: ['dron'] }), []);
  assert.equal(problemaPlantilla({ nombre: '', items: [] }), 'La plantilla necesita un nombre.');
  assert.match(problemaPlantilla({ nombre: 'X', items: [] }), /al menos un ítem/);
  assert.match(problemaPlantilla({ nombre: 'X', items: [{ texto: ' ' }] }), /sin texto/);
  assert.equal(problemaPlantilla(PLANTILLAS_BASE[0]), '');
});
