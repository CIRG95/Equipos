// pruebas/lineas-corredor.test.mjs — cantidad y ubicación de líneas del corredor (regla de DJI Pilot 2).
// Casos de control medidos en el control remoto (Matrice 4E · traslape 80/70 % · 15 m/s · sin margen), 5-nov-2026.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularPlan, alturaParaGsd } from '../modulos/vuelos/calculo.js';
import { pasadasPorLado, pasadasCorredor } from '../modulos/vuelos/geom.js';
import { DRONES_BASE } from '../modulos/vuelos/drones.js';

const m4e = DRONES_BASE.find(d => d.id === 'm4e');
const eje = [[0, 0], [2000, 0]];

function plan(ancho, gsd) {
  return calcularPlan({
    dron: m4e, modo: 'foto', altura: alturaParaGsd(m4e, gsd), traslapeFrontal: 0.8, traslapeLateral: 0.7,
    velocidad: 15, exposicion: 1 / 1000, reserva: 0.2, minDespegue: 2, minCambio: 3, segGiro: 8,
    eje, izq: ancho / 2, der: ancho / 2, despegue: [1000, 0],
  });
}

const CASOS = [[40, 3.5, 2], [80, 3.5, 2], [80, 1.0, 6], [240, 3.5, 4], [260, 3.5, 4], [280, 3.5, 6]];

for (const [ancho, gsd, lineas] of CASOS) {
  test(`corredor de ${ancho} m a ${gsd} cm/px → ${lineas} líneas (DJI)`, () => {
    assert.equal(plan(ancho, gsd).nLineas, lineas);
  });
}

test('Matrice 4E: altura para 3,5 cm/px = 130,3 m (como DJI)', () => {
  assert.equal(Math.round(alturaParaGsd(m4e, 3.5) * 10) / 10, 130.3);
});

test('franja 184,8 m y separación 55,44 m a 3,5 cm/px con 70 % lateral', () => {
  const r = plan(240, 3.5);
  assert.equal(Math.round(r.detalle.franja * 10) / 10, 184.8);
  assert.equal(Math.round(r.sepLineas * 100) / 100, 55.44);
  assert.equal(r.detalle.lados.izq.pasadas, 2);
  assert.equal(r.detalle.lados.der.pasadas, 2);
});

test('el eje no se vuela: pasadas a (k − ½) × separación del eje', () => {
  const p = pasadasCorredor(eje, 120, 120, 55.44).map(l => Math.round(l[0][1] * 10) / 10);
  assert.deepEqual(p, [-83.2, -27.7, 27.7, 83.2]);
});

test('cada lado por separado y mínimo 1 por lado', () => {
  assert.equal(pasadasPorLado(5, 55.44), 1);
  assert.equal(pasadasCorredor(eje, 200, 20, 55.44).length, 4 + 1);
});

test('duración de la ruta como DJI: recorrido + giros + 20 s', () => {
  const r = plan(240, 3.5);
  const esperado = (r.distancia / 15 + (r.nLineas - 1) * 8 + 20) / 60;
  assert.ok(Math.abs(r.minRutaDji - esperado) < 1e-9);
});
