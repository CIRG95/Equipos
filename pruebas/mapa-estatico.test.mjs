// pruebas/mapa-estatico.test.mjs — fondo fijo de teselas para los esquemas (v0.11.3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fondoEstatico } from '../modulos/vuelos/mapa-estatico.js';

test('el recuadro queda dentro del esquema y las teselas lo cubren entero', () => {
  const pts = [[-70.21, -27.10], [-70.15, -27.05], [-70.18, -27.02]];
  const W = 700, H = 260, f = fondoEstatico(pts, W, H, { margen: 18 });
  for (const p of pts) { const [x, y] = f.xy(p); assert.ok(x >= 17 && x <= W - 17 && y >= 17 && y <= H - 17, `${x},${y}`); }
  const imgs = [...f.html.matchAll(/left:(-?[\d.]+)%;top:(-?[\d.]+)%;width:([\d.]+)%;height:([\d.]+)%/g)].map(m => m.slice(1).map(Number));
  assert.ok(imgs.length >= 3);
  const capa = imgs.slice(0, imgs.length / 3); // imagen (las otras dos capas son caminos y nombres)
  assert.ok(Math.min(...capa.map(i => i[0])) <= 0 && Math.max(...capa.map(i => i[0] + i[2])) >= 100);
  assert.ok(Math.min(...capa.map(i => i[1])) <= 0 && Math.max(...capa.map(i => i[1] + i[3])) >= 100);
});
