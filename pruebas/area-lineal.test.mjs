// pruebas/area-lineal.test.mjs — eje automático de un área lineal, cortes por método y cortes paralelos (v0.8).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nuevaHoja, geometria, nombreSector, calcularSector, totales } from '../modulos/vuelos/hoja.js';
import { ejeDePoligono, cortesParalelos, aplicarCortes, areaFirmada } from '../modulos/vuelos/geom.js';
import { formaDe, generarCortes, vistaPrevia, corredorDesdeEje } from '../modulos/vuelos/cortes.js';
import { DRONES_BASE } from '../modulos/vuelos/drones.js';

const m4e = DRONES_BASE.find(d => d.id === 'm4e');
const cerca = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

/** Franja curva de largo ~L km y ancho w m (lon/lat), como una línea de transmisión o canal. */
function franja(Lkm, w, n = 400) {
  const lat0 = -22.3, lon0 = -70.0, kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 110540;
  const eje = Array.from({ length: n }, (_, i) => { const t = i / (n - 1), x = t * Lkm * 1000, y = 3000 * Math.sin(t * Math.PI * 1.5); return [x, y]; });
  const izq = [], der = [];
  for (let i = 0; i < n; i++) {
    const a = eje[Math.max(0, i - 1)], b = eje[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
    const nx = -dy / l, ny = dx / l;
    izq.push([eje[i][0] + nx * w / 2, eje[i][1] + ny * w / 2]); der.push([eje[i][0] - nx * w / 2, eje[i][1] - ny * w / 2]);
  }
  const anillo = [...izq, ...der.reverse()].map(([x, y]) => [lon0 + x / kx, lat0 + y / ky]);
  anillo.push(anillo[0]);
  return anillo;
}
const hojaCon = anillo => { const h = nuevaHoja(); h.area.tipo = 'poligono'; h.area.original = { nombre: 'franja', anillo }; return h; };

test('eje automático: largo y ancho de una franja curva', () => {
  const h = hojaCon(franja(40, 120));
  const f = formaDe(h);
  assert.ok(f.lineal, 'debe detectarse como área lineal');
  cerca(f.anchoProm, 120, 8, 'ancho promedio');
  assert.ok(f.largo > 40000 && f.largo < 42500, `largo ${f.largo}`);
});

test('un rectángulo ancho no es lineal', () => {
  const h = hojaCon([[-70.6, -32.83], [-70.58, -32.83], [-70.58, -32.815], [-70.6, -32.815], [-70.6, -32.83]]);
  assert.equal(formaDe(h).lineal, false);
});

test('área lineal: cortes cada 5 km con DM y sectores en orden', () => {
  const h = hojaCon(franja(40, 120));
  h.area.dm = { inicio: 0, desc: false };
  h.area.auto = { modo: 'distancia', cada: '5', unidad: 'km' };
  assert.equal(vistaPrevia(h).sectores, 9);
  const r = generarCortes(h, { dron: m4e });
  h.area.cortes = r.cortes;
  const g = geometria(h);
  assert.equal(g.fallidos.length, 0, 'todos los cortes cruzan');
  assert.equal(g.sectores.length, 9);
  assert.equal(nombreSector(h, 0, 9), '0+000 – 5+000');
  assert.equal(nombreSector(h, 1, 9), '5+000 – 10+000');
  const t = totales(h, m4e, g);
  assert.ok(t.baterias < 40, `con sectores las baterías bajan a algo razonable: ${t.baterias}`);
});

test('área lineal: por superficie (cada 60 ha)', () => {
  const h = hojaCon(franja(40, 120));
  h.area.auto = { modo: 'superficie', sup: '60', unidadSup: 'ha' };
  h.area.cortes = generarCortes(h, { dron: m4e }).cortes;
  const g = geometria(h);
  assert.equal(g.fallidos.length, 0);
  for (const s of g.sectores.slice(0, -1)) cerca(s.area / 1e4, 60, 4, 'ha por sector');
});

test('área lineal pasada a corredor sobre el eje', () => {
  const h = hojaCon(franja(20, 100));
  formaDe(h);
  assert.ok(corredorDesdeEje(h));
  const g = geometria(h);
  assert.equal(g.tipo, 'corredor');
  assert.ok(calcularSector(h, m4e, g, 0));
});

test('cortes paralelos de igual superficie con rotación', () => {
  const poli = [[0, 0], [1000, 0], [1400, 600], [300, 900], [-100, 400]];
  const total = Math.abs(areaFirmada(poli));
  for (const rumbo of [0, 35, 90]) {
    const { sectores, fallidos } = aplicarCortes(poli, cortesParalelos(poli, 4, rumbo));
    assert.equal(fallidos.length, 0); assert.equal(sectores.length, 4);
    for (const s of sectores) cerca(Math.abs(areaFirmada(s)), total / 4, total * 0.01, `rumbo ${rumbo}`);
  }
});

test('por días de vuelo y por baterías en un área extensa', () => {
  const h = hojaCon([[-70.6, -32.85], [-70.55, -32.85], [-70.55, -32.81], [-70.6, -32.81], [-70.6, -32.85]]);
  h.area.auto = { modo: 'baterias', bat: '3' };
  h.area.cortes = generarCortes(h, { dron: m4e }).cortes;
  let g = geometria(h);
  g.sectores.forEach((_, i) => assert.ok(calcularSector(h, m4e, g, i).vuelos <= 3));
  h.area.cortes = []; h.area.auto = { modo: 'dias', horas: '5' };
  h.area.cortes = generarCortes(h, { dron: m4e }).cortes;
  g = geometria(h);
  g.sectores.forEach((_, i) => assert.ok(calcularSector(h, m4e, g, i).minTotal <= 300));
});

test('rendimiento: área lineal de 130 km con 20.000 vértices', () => {
  const t0 = Date.now();
  const h = hojaCon(franja(130, 120, 10000));
  h.area.auto = { modo: 'distancia', cada: '5', unidad: 'km' };
  h.area.cortes = generarCortes(h, { dron: m4e }).cortes;
  const g = geometria(h);
  assert.equal(g.sectores.length, 27);
  assert.ok(Date.now() - t0 < 8000, `tardó ${Date.now() - t0} ms`);
});
