// v0.21.3 · Fotos en lote: reparto por nombre, GPS y orden.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fichaPorNombre, tipoPorNombre, repartir, repartirEnOrden, gpsDeJpeg, distanciaM } from '../modulos/monografias/fotos-lote.js';

const FICHAS = [
  { id: 'a', nombre: 'PR-1', lat: -33.0, lon: -70.0 },
  { id: 'b', nombre: 'PR-10', lat: -33.001, lon: -70.0 },
  { id: 'c', nombre: 'PR-2', lat: -33.002, lon: -70.0, tienePano: true },
];

test('por nombre: PR-1 no calza con PR-10', () => {
  assert.equal(fichaPorNombre('PR-1_pano.jpg', FICHAS).id, 'a');
  assert.equal(fichaPorNombre('pr 10 croquis.JPG', FICHAS).id, 'b');
  assert.equal(fichaPorNombre('IMG-20261118-WA0012.jpg', FICHAS), null);
  assert.equal(fichaPorNombre('PR2.jpg', FICHAS).id, 'c');
});

test('tipo por nombre', () => {
  assert.equal(tipoPorNombre('PR-1 croquis.jpg'), 'croquisImg');
  assert.equal(tipoPorNombre('PR-1_pano.jpg'), 'panoramicaImg');
  assert.equal(tipoPorNombre('PR-1.jpg'), null);
});

test('reparto: nombre, GPS a menos de 30 m, sin asignar; tipos por defecto', () => {
  const r = repartir([
    { nombre: 'PR-1.jpg' },
    { nombre: 'IMG_20261118_153012.jpg', gps: { lat: -33.00101, lon: -70.0 } },
    { nombre: 'IMG_lejos.jpg', gps: { lat: -33.01, lon: -70.0 } },
    { nombre: 'IMG-WA0001.jpg' },
    { nombre: 'PR2.jpg' },
  ], FICHAS);
  assert.deepEqual(r.map(f => f.fichaId), ['a', 'b', null, null, 'c']);
  assert.deepEqual(r.map(f => f.origen), ['nombre', 'gps', null, null, 'nombre']);
  assert.ok(r[1].distancia < 2);
  assert.equal(r[0].tipo, 'panoramicaImg');
  assert.equal(r[4].tipo, 'extra', 'PR-2 ya tenía panorámica');
});

test('repartir en orden a las fichas sin foto', () => {
  const r = repartirEnOrden([{ nombre: 'PR-1.jpg', fichaId: 'a', tipo: 'panoramicaImg' }, { nombre: 'x1.jpg', fichaId: null }, { nombre: 'x2.jpg', fichaId: null }, { nombre: 'x3.jpg', fichaId: null }], FICHAS);
  assert.deepEqual(r.map(f => f.fichaId), ['a', 'b', 'c', null]);
});

test('GPS desde el EXIF de un JPEG', () => {
  // JPEG mínimo: SOI + APP1 Exif con IFD0 → GPS IFD (33° 26' 45" S, 70° 39' 0" W)
  const tiff = []; const T = { u16: n => tiff.push(n & 255, n >> 8), u32: n => { T.u16(n & 0xffff); T.u16(n >>> 16); } };
  T.u16(0x4949); T.u16(42); T.u32(8);                       // cabecera, IFD0 en 8
  T.u16(1); T.u16(0x8825); T.u16(4); T.u32(1); T.u32(26); T.u32(0); // IFD0: puntero GPS → 26
  T.u16(4);                                                 // GPS IFD en 26: 4 entradas
  T.u16(1); T.u16(2); T.u32(2); tiff.push(83, 0, 0, 0);     // LatRef 'S'
  T.u16(2); T.u16(5); T.u32(3); T.u32(80);                  // Lat → 80
  T.u16(3); T.u16(2); T.u32(2); tiff.push(87, 0, 0, 0);     // LonRef 'W'
  T.u16(4); T.u16(5); T.u32(3); T.u32(104);                 // Lon → 104
  T.u32(0);
  while (tiff.length < 80) tiff.push(0);
  for (const [n, d] of [[33, 1], [26, 1], [45, 1], [70, 1], [39, 1], [0, 1]]) { T.u32(n); T.u32(d); }
  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const bytes = [0xFF, 0xD8, 0xFF, 0xE1, (app1.length + 2) >> 8, (app1.length + 2) & 255, ...app1, 0xFF, 0xD9];
  const g = gpsDeJpeg(new Uint8Array(bytes).buffer);
  assert.ok(Math.abs(g.lat - (-33.445833)) < 1e-5, String(g && g.lat));
  assert.ok(Math.abs(g.lon - (-70.65)) < 1e-9);
  assert.equal(gpsDeJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer), null);
  assert.ok(Math.abs(distanciaM(-33, -70, -33.001, -70) - 111.2) < 0.5);
});
