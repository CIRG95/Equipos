// pruebas/jornadas.test.mjs — jornadas necesarias según el horario de vuelo (v0.10).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nuevaHoja, geometria, totales, jornadasNecesarias, minutosUtiles } from '../modulos/vuelos/hoja.js';
import { DRONES_BASE } from '../modulos/vuelos/drones.js';

const m4e = DRONES_BASE.find(d => d.id === 'm4e');
const hoja = () => { const h = nuevaHoja(); h.area.tipo = 'poligono'; h.area.original = { nombre: 'p', anillo: [[-70.6, -32.86], [-70.52, -32.86], [-70.52, -32.80], [-70.6, -32.80], [-70.6, -32.86]] };
  // 4 cortes norte-sur → 5 sectores
  h.area.cortes = [-70.584, -70.568, -70.552, -70.536].map(x => [[x, -32.87], [x, -32.79]]); return h; };

test('minutos útiles del horario', () => {
  assert.equal(minutosUtiles({ inicio: '08:30', fin: '17:30', pausa: 60 }), 480);
  assert.equal(minutosUtiles({ inicio: '09:00', fin: '13:00', pausa: 0 }), 240);
});

test('cada jornada toma sectores completos sin pasar el horario', () => {
  const h = hoja(), g = geometria(h), t = totales(h, m4e, g);
  assert.equal(g.sectores.length, 5);
  h.params.horario = { inicio: '08:00', fin: '18:00', pausa: 60 };
  const j = jornadasNecesarias(h, m4e, g, t);
  assert.deepEqual(j.dias.flatMap(d => d.sectores), [0, 1, 2, 3, 4], 'todos los sectores, en orden');
  for (const d of j.dias) if (d.sectores.length > 1) assert.ok(d.min <= j.util, `día de ${d.min} min con ${j.util} útiles`);
  const total = t.sectores.reduce((s, r) => s + r.minTotal, 0);
  assert.ok(j.dias.length >= Math.ceil(total / j.util), 'no menos días que el mínimo teórico');
  // con un horario corto hacen falta más jornadas
  h.params.horario = { inicio: '09:00', fin: '12:00', pausa: 0, traslado: 15 };
  assert.ok(jornadasNecesarias(h, m4e, g, t).dias.length >= j.dias.length);
});
