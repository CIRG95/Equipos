// pruebas/cortes-medida.test.mjs — v0.9: «Cortes a medida» y sentido del eje.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nuevaHoja, geometria, nombreSector, kmADm, kmEnEje, sDeKm } from '../modulos/vuelos/hoja.js';
import { kmCortesAMedida, generarCortes, tramosVistaPrevia } from '../modulos/vuelos/cortes.js';

const tramos = (k0, k1, cortes) => { const p = [k0, ...cortes, k1]; return p.slice(1).map((k, i) => `${kmADm(Math.min(p[i], k))} – ${kmADm(Math.max(p[i], k))}`); };

test('ejemplo Línea 1: 4+900 y 10+200 fijos, luego cada 5 km hasta 159+160 → 32 sectores', () => {
  const c = kmCortesAMedida(0, 159.16, [4.9, 10.2], 5000);
  const t = tramos(0, 159.16, c);
  assert.equal(t.length, 32);
  assert.deepEqual(t.slice(0, 4), ['0+000 – 4+900', '4+900 – 10+200', '10+200 – 15+200', '15+200 – 20+200']);
  assert.equal(t[t.length - 2], '150+200 – 155+200');
  assert.equal(t[t.length - 1], '155+200 – 159+160'); // el último termina en el fin del eje
});

test('sin cortes fijos = cada X desde el inicio; fijos fuera del eje se ignoran; DM que decrece', () => {
  assert.deepEqual(kmCortesAMedida(0, 12, [], 5000), [5, 10]);
  assert.deepEqual(kmCortesAMedida(0, 12, [-1, 3, 20, 3], 0), [3]);
  assert.deepEqual(kmCortesAMedida(20, 8, [17.5], 5000), [17.5, 12.5]);
});

// Eje recto de ~10 km hacia el este (corredor).
const hojaEje = () => { const h = nuevaHoja(); h.area.tipo = 'corredor'; h.area.eje = { nombre: 'eje', linea: [[-70.6, -32.83], [-70.4934, -32.83]], largo: 10000 }; h.area.corredor = { izq: 40, der: 40, mismo: true }; h.area.dm = { inicio: 0, texto: '0+000' }; return h; };

test('sentido: DM y metros se convierten en los dos sentidos', () => {
  const a = { dm: { inicio: 0 } };
  assert.equal(kmEnEje(a, 2500, 10000), 2.5);
  a.dm.inv = true;
  assert.equal(kmEnEje(a, 2500, 10000), 7.5);
  assert.equal(sDeKm(a, 7.5, 10000), 2500);
});

test('cortes a medida en el corredor, normal e invertido: S1 siempre empieza en 0+000', () => {
  for (const inv of [false, true]) {
    const h = hojaEje(); h.area.dm.inv = inv;
    h.area.auto = { modo: 'medida', fijos: ['2+000'], cada: '3', unidad: 'km' };
    const r = generarCortes(h);
    h.area.cortes = r.cortes;
    const g = geometria(h);
    assert.equal(g.fallidos.length, 0);
    const n = g.sectores.length;
    const nombres = g.sectores.map((_, i) => nombreSector(h, i, n));
    assert.equal(nombres[0].split(' – ')[0], '0+000', `inv=${inv}: ${nombres}`);
    assert.equal(nombres[1].split(' – ')[0], '2+000', `inv=${inv}: ${nombres}`);
    assert.equal(nombres[2].split(' – ')[0], '5+000', `inv=${inv}: ${nombres}`);
    const v = tramosVistaPrevia(h);
    assert.equal(v.tramos.length, n);
  }
});
