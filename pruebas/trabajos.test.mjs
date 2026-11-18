import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trabajosDeProyecto, cronogramaDeTrabajos, avisosOrden, moverTrabajo, finDeTrabajo } from '../app/trabajos.js';

test('orden sugerido: GNSS antes que vuelos; respeta el orden guardado y suma tipos nuevos', () => {
  assert.deepEqual(trabajosDeProyecto({ tiposTrabajo: ['dron', 'estacion', 'gnss'] }).map(t => t.cat), ['gnss', 'dron', 'estacion']);
  const p = { tiposTrabajo: ['dron', 'gnss', 'estacion'], trabajos: [{ cat: 'dron', dias: 3 }, { cat: 'gnss', dias: 2, paralelo: true }] };
  const t = trabajosDeProyecto(p);
  assert.deepEqual(t.map(x => x.cat), ['dron', 'gnss', 'estacion']);
  assert.equal(t[1].paralelo, true);
  assert.deepEqual(trabajosDeProyecto({ tiposTrabajo: ['gnss'], trabajos: [{ cat: 'dron', dias: 3 }] }).map(x => x.cat), ['gnss'], 'quita los tipos que ya no están');
});

test('días hábiles: un trabajo de 3 días que parte el viernes termina el martes', () => {
  assert.equal(finDeTrabajo('2026-11-20', 3), '2026-11-24');
  assert.equal(finDeTrabajo('2026-11-21', 1), '2026-11-23', 'si parte un sábado, empieza el lunes');
});

test('cronograma: en orden, con trabajos en paralelo y gabinete hasta el plazo', () => {
  const t = [{ cat: 'gnss', dias: 2 }, { cat: 'dron', dias: 3, paralelo: true }, { cat: 'estacion', dias: 2 }];
  const c = cronogramaDeTrabajos(t, '2026-11-16', { nombre: x => x.toUpperCase(), plazo: '2026-12-04' });
  assert.deepEqual(c.map(a => [a.cat, a.desde, a.hasta]), [
    ['gnss', '2026-11-16', '2026-11-17'],
    ['dron', '2026-11-16', '2026-11-18'],
    ['estacion', '2026-11-19', '2026-11-20'],
    ['gabinete', '2026-11-23', '2026-12-04'],
  ]);
  assert.match(c[1].nombre, /por baterías/);
});

test('los días de vuelo pueden venir de la hoja de vuelo', () => {
  const c = cronogramaDeTrabajos([{ cat: 'dron', dias: 1 }], '2026-11-16', { diasDe: t => (t.cat === 'dron' ? 4 : t.dias) });
  assert.equal(c[0].hasta, '2026-11-19');
});

test('avisa si los vuelos necesitan PR nuevos y van antes de la red GNSS', () => {
  assert.equal(avisosOrden([{ cat: 'dron' }, { cat: 'gnss' }], { prsNuevos: 2 }).length, 1);
  assert.equal(avisosOrden([{ cat: 'gnss' }, { cat: 'dron' }], { prsNuevos: 2 }).length, 0);
  assert.equal(avisosOrden([{ cat: 'dron' }], { prsNuevos: 1 }).length, 1);
  assert.equal(avisosOrden([{ cat: 'dron' }, { cat: 'gnss' }], { prsNuevos: 0 }).length, 0);
});

test('mover un trabajo; el primero nunca queda «en paralelo»', () => {
  const t = moverTrabajo([{ cat: 'gnss' }, { cat: 'dron', paralelo: true }], 1, 0);
  assert.deepEqual(t.map(x => [x.cat, !!x.paralelo]), [['dron', false], ['gnss', false]]);
});
