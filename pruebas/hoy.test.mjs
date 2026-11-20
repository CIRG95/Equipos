// v0.19 · Pantalla Hoy: grupos con verbo, acción principal y semáforo por proyecto (datos ficticios).
import test from 'node:test';
import assert from 'node:assert/strict';
import { agruparPendientes, accionPrincipal, semaforoProyecto, contarSemaforo, verboDe } from '../app/hoy.js';

const HOY = '2026-11-19';

test('agruparPendientes: un grupo por tipo, con verbo, y los urgentes primero', () => {
  const g = agruparPendientes([
    { nivel: 'ambar', categoria: 'Personal', titulo: 'Licencia · Ana' },
    { nivel: 'ambar', categoria: 'Personal', titulo: 'Examen · Luis' },
    { nivel: 'rojo', categoria: 'Equipos', titulo: 'Calibración vencida · GNSS 2' },
    { nivel: 'ambar', titulo: 'Sin tipo' },
  ]);
  assert.deepEqual(g.map(x => x.categoria), ['Equipos', 'Personal', 'Otros']);
  assert.equal(g[0].verbo, 'Calibrar equipos');
  assert.equal(g[0].urgentes, 1);
  assert.equal(g[1].items.length, 2);
  assert.equal(verboDe('Algo nuevo'), 'Algo nuevo');
});

test('accionPrincipal: el pendiente más urgente, o la acción típica del rol', () => {
  const a = accionPrincipal('terreno', [{ nivel: 'ambar', titulo: 'B', enlace: '#/b' }, { nivel: 'rojo', titulo: 'A', enlace: '#/a' }]);
  assert.equal(a.texto, 'A'); assert.equal(a.enlace, '#/a'); assert.ok(a.pendiente);
  const d = accionPrincipal('direccion', []);
  assert.equal(d.enlace, '#/encargo/nuevo'); assert.equal(d.pendiente, false);
  assert.equal(accionPrincipal('rrhh', [{ nivel: 'gris', titulo: 'x' }]).enlace, '#/personal');
});

test('semaforoProyecto: rojo, ámbar y verde con el motivo en palabras simples', () => {
  const rojo = semaforoProyecto({ plazo: '2026-11-10', bitacora: [{ tipo: 'consulta', texto: '¿Cota?' }] }, HOY);
  assert.equal(rojo.color, 'rojo'); assert.match(rojo.motivo, /^Plazo vencido hace 9 días · 1 consulta sin responder$/);
  const ambar = semaforoProyecto({ plazo: '2026-11-21', encargadoId: 'per-a', encargo: { emitidoEn: '2026-11-18', emitidoPor: 'per-j' } }, HOY);
  assert.equal(ambar.color, 'ambar'); assert.match(ambar.motivo, /confirma que lo recibió · vence en 2 días/);
  const atr = semaforoProyecto({ cronograma: [{ nombre: 'Terreno', desde: '2026-11-01', hasta: '2026-11-10' }, { nombre: 'Gabinete', desde: '2026-11-11', hasta: '2026-11-30', hecho: false }] }, HOY);
  assert.equal(atr.color, 'ambar'); assert.match(atr.motivo, /1 actividad atrasada/);
  const verde = semaforoProyecto({ plazo: '2027-01-30', cronograma: [{ nombre: 'Terreno', desde: '2026-11-01', hasta: '2026-11-10', hecho: true }, { nombre: 'Gabinete', desde: '2026-11-11', hasta: '2026-12-30' }] }, HOY);
  assert.equal(verde.color, 'verde'); assert.equal(verde.motivo, 'Avanza bien · 50 %'); assert.equal(verde.pct, 50);
  assert.equal(semaforoProyecto({ plazo: '2026-01-01', periodicidad: { tipo: 'recurrente' }, cronograma: null }, HOY).color, 'verde');
  assert.deepEqual(contarSemaforo([rojo, ambar, atr, verde]), { rojo: 1, ambar: 2, verde: 1 });
});
