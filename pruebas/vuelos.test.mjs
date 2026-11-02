// pruebas/vuelos.test.mjs — pruebas de cálculo de Vuelos (sin navegador). Se corren en construir.sh: node --test pruebas/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gsdCm, alturaParaGsd, areaM2, fmtDuracion } from '../modulos/vuelos/calculo.js';
import { margenPoligono, aplicarCortes, poligonoCorredor, largo } from '../modulos/vuelos/geom.js';
import { nuevaHoja, geometria, calcularSector, totales, rumboMasCorto, diasHabiles } from '../modulos/vuelos/hoja.js';
import { DRONES_BASE } from '../modulos/vuelos/drones.js';
import { analizarDia } from '../modulos/vuelos/pronostico-widget.js';

const m4e = DRONES_BASE.find(d => d.id === 'm4e');
const cerca = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
// Cuadrado de ~1 km por lado cerca de Los Andes (lon, lat).
const cuadrado = (lon0, lat0, lado = 0.0107, alto = 0.009) => [[lon0, lat0], [lon0 + lado, lat0], [lon0 + lado, lat0 + alto], [lon0, lat0 + alto], [lon0, lat0]];
const hojaCon = anillo => { const h = nuevaHoja(); h.area.tipo = 'poligono'; h.area.original = { nombre: 'prueba', anillo }; return h; };

test('GSD y altura son inversos', () => {
  for (const g of [1, 2.5, 4]) cerca(gsdCm(m4e, alturaParaGsd(m4e, g)), g, 1e-9, 'gsd');
  cerca(gsdCm(m4e, 100), 2.666, 0.01, 'M4E a 100 m');
});

test('fmtDuracion redondea bien', () => {
  assert.equal(fmtDuracion(119.6), '2 h 00 min');
  assert.equal(fmtDuracion(45.2), '45 min');
});

test('margen de 10 m a un cuadrado de 100 m (esquinas rectas)', () => {
  const sq = [[0, 0], [100, 0], [100, 100], [0, 100]];
  cerca(areaM2(margenPoligono(sq, 10, { rectas: true })), 120 * 120, 1, 'área con margen');
  assert.ok(areaM2(margenPoligono(sq, 10, { rectas: false })) < 120 * 120, 'redondeado es menor');
});

test('un corte de lado a lado divide en 2 y conserva el área', () => {
  const sq = [[0, 0], [100, 0], [100, 100], [0, 100]];
  const { sectores, fallidos } = aplicarCortes(sq, [[[50, -10], [50, 110]]]);
  assert.equal(sectores.length, 2); assert.equal(fallidos.length, 0);
  cerca(sectores.reduce((s, p) => s + areaM2(p), 0), 10000, 1, 'suma de sectores');
  assert.equal(aplicarCortes(sq, [[[50, -10], [50, 40]]]).sectores.length, 1, 'corte que no cruza no divide');
});

test('corredor: área = largo × ancho', () => {
  const eje = [[0, 0], [1000, 0]];
  cerca(areaM2(poligonoCorredor(eje, 40, 40)), largo(eje) * 80, 5, 'corredor recto');
});

test('hoja: más área → más baterías; totales cuadran', () => {
  const chica = hojaCon(cuadrado(-70.6, -32.83)), grande = hojaCon(cuadrado(-70.6, -32.83, 0.032, 0.027));
  const tc = totales(chica, m4e, geometria(chica)), tg = totales(grande, m4e, geometria(grande));
  assert.ok(tc.baterias >= 1); assert.ok(tg.baterias > tc.baterias, `${tg.baterias} > ${tc.baterias}`);
  cerca(geometria(chica).areaVuelo / 10000, 100, 3, 'cuadrado de ~100 ha');
});

test('margen en la hoja agranda el área de vuelo', () => {
  const h = hojaCon(cuadrado(-70.6, -32.83)); const a0 = geometria(h).areaVuelo;
  h.area.margen = 30; assert.ok(geometria(h).areaVuelo > a0);
});

test('rumbo más corto no es peor que el automático', () => {
  const h = hojaCon(cuadrado(-70.6, -32.83)), g = geometria(h);
  const r = calcularSector(h, m4e, g, 0);
  const m = rumboMasCorto(h, m4e, g, 0, r.velocidad);
  assert.ok(m.rumbo >= 0 && m.rumbo < 180); assert.ok(m.minTotal <= r.minTotal + 1e-6);
});

test('días hábiles sin contar fin de semana', () => {
  assert.equal(diasHabiles('2026-10-30', '2026-11-02'), 1); // vie → lun
  assert.equal(diasHabiles('2026-10-26', '2026-11-04'), 7);
});

test('pronóstico: ventana GO con viento bajo y NO con viento alto', () => {
  const horas = [];
  for (let h = 0; h < 24; h++) horas.push({ t: `2026-11-03T${String(h).padStart(2, '0')}:00`, fecha: '2026-11-03', hora: h, v: h < 14 ? 4 : 15, vMin: 3, vMax: 5, g: h < 14 ? 6 : 18, dir: 220, lluvia: 0, prob: 0, nubes: 10, temp: 15, sol: h >= 7 && h <= 20 ? 30 : -10 });
  const r = analizarDia({ horas, dias: [{ fecha: '2026-11-03', salida: '2026-11-03T07:00', puesta: '2026-11-03T20:00' }] }, m4e, null, '2026-11-03');
  assert.deepEqual(r.ventana, [7, 13]);
  assert.ok(r.checklist.find(x => /Ráfagas/.test(x.texto)).cumple, 'dentro de la ventana las ráfagas cumplen');
});
