import { test } from 'node:test';
import assert from 'node:assert/strict';
import { delaunay, vectoresSugeridos, preAnalisis, evaluarPunto, reforzar, planificarSesiones, tiempoPara, sugerirPR, marcasArea, marcasCorredor, invertir, puntoEnPoligono } from '../modulos/planificacion/modelo.js';

const cuadro = [[0, 0], [2000, 0], [2000, 1500], [0, 1500]];

test('inversa de Gauss-Jordan', () => {
  const Q = invertir([[4, 1], [1, 3]]);
  assert.ok(Math.abs(Q[0][0] - 3 / 11) < 1e-12 && Math.abs(Q[0][1] + 1 / 11) < 1e-12);
  assert.equal(invertir([[1, 1], [1, 1]]), null);
});

test('Delaunay de un cuadrado con centro: 8 aristas', () => {
  const e = delaunay([[0, 0], [10, 0], [10, 10], [0, 10], [5, 5]]);
  assert.equal(e.length, 8);
});

test('pre-análisis: una cadena simple es peor que una red triangulada', () => {
  const pts = [[0, 0], [1000, 0], [2000, 0], [1000, 800]];
  const cadena = preAnalisis(pts, [[0, 1], [1, 2]], { fijos: [0] });
  assert.equal(evaluarPunto(cadena.puntos[2], 20).nivel, 'malo'); // un solo vector
  assert.equal(evaluarPunto(cadena.puntos[3], 20).nivel, 'malo'); // desconectado
  assert.equal(cadena.puntos[3].s95, Infinity);
  const red = preAnalisis(pts, [[0, 1], [1, 2], [0, 3], [1, 3], [2, 3]], { fijos: [0] });
  assert.ok(red.puntos[2].s95 < 20 && red.puntos[2].grado === 2);
  // σ de un vector de 1 km con 5 mm + 1 ppm = 6 mm → σ95 de un punto colgado = 2,4477·6 ≈ 14,7 mm
  const uno = preAnalisis([[0, 0], [1000, 0]], [[0, 1]], { fijos: [0] });
  assert.ok(Math.abs(uno.puntos[1].s95 - 2.4477 * 6) < 1e-6);
});

test('reforzar deja todos los puntos con al menos 3 vectores o en verde', () => {
  const pts = [[0, 0], [1000, 0], [2000, 0], [1000, 800], [2500, 900]];
  const v = reforzar(pts, [[0, 1], [1, 2], [2, 4]], { fijos: [0] });
  const pa = preAnalisis(pts, v, { fijos: [0] });
  assert.ok(pa.puntos.every(r => evaluarPunto(r, 20).nivel !== 'malo'));
});

test('sesiones con 3 receptores cubren todos los vectores y encadenan', () => {
  const pts = [[0, 0], [1000, 0], [2000, 0], [500, 800], [1500, 800]];
  const vec = vectoresSugeridos(pts);
  const tabla = [{ hastaKm: 1, minutos: 30 }, { hastaKm: 5, minutos: 60 }];
  const ses = planificarSesiones(pts, vec, { receptores: 3, tabla });
  const cubiertos = ses.flatMap(s => s.vectores.map(([a, b]) => [a, b].sort().join(','))).sort();
  assert.deepEqual(cubiertos, vec.map(([a, b]) => [a, b].sort().join(',')).sort());
  for (let k = 1; k < ses.length; k++) assert.ok(ses[k].puntos.some(p => ses[k - 1].puntos.includes(p)), 'comparte un punto con la anterior');
  assert.equal(tiempoPara(800, tabla), 30);
  assert.equal(tiempoPara(1200, tabla), 60);
  assert.equal(tiempoPara(9000, tabla), null);
});

test('sugerencia de PR: la partida queda sobre el camino y todos dentro del área', () => {
  const camino = [[-300, 700], [2300, 700]];
  const r = sugerirPR(cuadro, { n: 7, caminos: [camino] });
  assert.equal(r.partida, 'camino');
  assert.equal(r.puntos.length, 7);
  assert.ok(Math.abs(r.puntos[0][1] - 700) < 1);
  assert.ok(r.puntos.every(p => puntoEnPoligono(p, cuadro)));
});

test('marcas de vuelo: área con esquinas y chequeos; corredor con extremos en pares', () => {
  const m = marcasArea(cuadro, { espaciado: 400 });
  assert.ok(m.filter(x => x.tipo === 'control').length >= 4);
  assert.ok(m.filter(x => x.tipo === 'chequeo').length >= 3);
  assert.ok(m.every(x => puntoEnPoligono(x.p, cuadro)));
  const c = marcasCorredor([[0, 0], [3000, 0]], { espaciado: 500, ancho: 100 });
  assert.equal(c.length, 2 + 5 + 2);
  assert.ok(c.some(x => x.tipo === 'chequeo'));
  assert.equal(Math.abs(c[0].p[1]), 40);
});
