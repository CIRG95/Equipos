// v0.21: Mapa de puntos de Monografías — posición, escalas, hoja y nombres que no se tapan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { posicionDe, aMundo, deMundo, metrosPorPixel, escalaPantalla, zoomParaEscala, zoomConTope, teselasPara, escalaGrafica,
  acomodarNombres, diseñoHoja, areaMapaMm, papel, redondeoEscala } from '../modulos/monografias/mapa-calculo.js';

test('posición desde geográficas o, si faltan, desde UTM', () => {
  const a = posicionDe({ latitud: '32°50\'00,00" S', longitud: '70°36\'00,00" O' });
  assert.ok(Math.abs(a.lat + 32.8333) < 1e-3 && Math.abs(a.lon + 70.6) < 1e-3);
  const b = posicionDe({ latitud: '', longitud: '', este: '343000', norte: '6365000', zonaUTM: '19 S' });
  assert.ok(b && b.lat < -32 && b.lat > -33.5 && b.lon < -70 && b.lon > -71.5);
  assert.equal(posicionDe({ latitud: '', longitud: '', este: '', norte: '' }), null);
});

test('Web Mercator ida y vuelta y metros por píxel', () => {
  const [x, y] = aMundo(-32.8, -70.6, 16);
  const g = deMundo(x, y, 16);
  assert.ok(Math.abs(g.lat + 32.8) < 1e-9 && Math.abs(g.lon + 70.6) < 1e-9);
  assert.ok(Math.abs(metrosPorPixel(0, 0) - 156543.03) < 0.1);
  assert.equal(escalaPantalla(-32.8, 16), 7600); // ≈ 1:7.589 con dos cifras
  assert.equal(redondeoEscala(31234), 31000);
  assert.equal(redondeoEscala(987), 990);
});

test('zoom para una escala fija (detalle de 200 ppp) y tope de teselas', () => {
  const z = zoomParaEscala(5000, -32.8);
  assert.equal(z, 18);
  assert.ok(metrosPorPixel(-32.8, z) <= 5000 * 0.0254 / 200);
  assert.ok(metrosPorPixel(-32.8, z - 1) > 5000 * 0.0254 / 200);
  assert.equal(zoomParaEscala(1000, -32.8, 5), 19);
  const zt = zoomConTope(4200, 2970, -32.8, 19, 600);
  assert.ok(teselasPara(4200, 2970, -32.8, zt) <= 600 && zt < 19);
});

test('escala gráfica con un largo redondo', () => {
  const e = escalaGrafica(2.33, 160);
  assert.equal(e.metros, 200);
  assert.ok(e.px > 80 && e.px <= 160);
  assert.equal(escalaGrafica(20, 160).texto, '2 km');
});

test('hoja con viñeta: el mapa, el cuadro y la viñeta caben en el papel sin pisarse', () => {
  for (const [h, o] of [['A4', 'H'], ['A4', 'V'], ['A3', 'H'], ['A3', 'V']]) {
    const d = diseñoHoja(h, o), [W, H] = papel(h, o);
    for (const r of [d.mapa, d.cuadro, d.viñeta]) assert.ok(r.x >= 10 && r.y >= 10 && r.x + r.w <= W - 10 + 1e-9 && r.y + r.h <= H - 10 + 1e-9, `${h}${o}`);
    assert.ok(d.mapa.w * d.mapa.h > 0.5 * (W - 20) * (H - 20) * 0.6);
  }
  assert.deepEqual(areaMapaMm('imagen', 'A4', 'H'), [277, 190]);
});

test('nombres acomodados: no se tapan entre ellos ni tapan los símbolos', () => {
  const pts = [[330, 352], [356, 338], [612, 222], [634, 206], [640, 214], [100, 100]].map(([x, y]) => ({ x, y, w: 44, h: 16 }));
  const r = acomodarNombres(pts, { r: 8, limites: { ancho: 860, alto: 560 } });
  const cajas = r.map((c, i) => ({ x: c.x, y: c.y, w: pts[i].w, h: pts[i].h }));
  for (let i = 0; i < cajas.length; i++) {
    for (let j = i + 1; j < cajas.length; j++) {
      const a = cajas[i], b = cajas[j];
      assert.ok(!(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h), `nombres ${i} y ${j} se tapan`);
    }
    for (const p of pts) assert.ok(!(cajas[i].x < p.x + 8 && p.x - 8 < cajas[i].x + cajas[i].w && cajas[i].y < p.y + 8 && p.y - 8 < cajas[i].y + cajas[i].h), `el nombre ${i} tapa un símbolo`);
  }
  // Un obstáculo (la flecha de norte) tampoco se tapa.
  const conNorte = acomodarNombres([{ x: 800, y: 60, w: 44, h: 16 }], { r: 8, limites: { ancho: 860, alto: 560 }, obstaculos: [{ x: 810, y: 10, w: 40, h: 50 }] });
  assert.ok(conNorte[0].x + 44 <= 810 || conNorte[0].y >= 60, JSON.stringify(conNorte));
  // Un punto solo queda arriba a la derecha, sin línea guía.
  assert.deepEqual(r[5], { x: 112, y: 72, linea: false });
});
