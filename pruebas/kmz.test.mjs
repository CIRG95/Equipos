// v0.21: exportar KML/KMZ en carpetas (red de PR, marcas GCP, vuelo con avance, monografías, proyecto completo).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kmlDe, kmzDe, colorKml, contarElementos } from '../compartido/kmz.js';
import { leerZip, leerCapa } from '../modulos/vuelos/kml.js';
import { carpetaRed, carpetaMarcas, carpetaVuelo, carpetaMonografias, documentoProyecto } from '../app/kmz-proyecto.js';
import { nuevaHoja, geometria } from '../modulos/vuelos/hoja.js';
import { calcularAmarreHoja } from '../modulos/vuelos/vista-amarre.js';

test('colores KML en aabbggrr', () => {
  assert.equal(colorKml('#E53935'), 'ff3539e5');
  assert.equal(colorKml('#00BCD4', 0.5), '80d4bc00');
});

test('carpetas, estilos compartidos y caracteres especiales', () => {
  const doc = { nombre: 'Proyecto «Ñuble» & Cía', carpetas: [
    { nombre: 'A', elementos: [
      { tipo: 'punto', nombre: 'PR-1 <nuevo>', coords: [-70.6, -32.8], estilo: { color: '#E53935', icono: 'triangulo' }, datos: { 'Cota (m)': '812,41' } },
      { tipo: 'punto', nombre: 'PR-2', coords: [-70.61, -32.81], estilo: { color: '#E53935', icono: 'triangulo' } },
    ] },
    { nombre: 'Vacía', elementos: [{ tipo: 'linea', nombre: 'sin geometría', coords: [[-70, -32]] }] },
  ] };
  const k = kmlDe(doc);
  assert.match(k, /Proyecto «Ñuble» &amp; Cía/);
  assert.match(k, /PR-1 &lt;nuevo&gt;/);
  assert.equal((k.match(/<Style id=/g) || []).length, 1, 'un solo estilo para los dos PR');
  assert.ok(!k.includes('Vacía'), 'las carpetas sin geometría no se escriben');
  assert.equal(contarElementos(doc), 2);
  assert.match(k, /<Data name="Cota \(m\)"><value>812,41<\/value><\/Data>/);
});

test('el KMZ es un zip con doc.kml que el mismo Sistema vuelve a leer', async () => {
  const doc = { nombre: 'x', carpetas: [{ nombre: 'Área', elementos: [{ tipo: 'poligono', nombre: 'Área 1', coords: [[-70.6, -32.8], [-70.59, -32.8], [-70.59, -32.79]], estilo: { color: '#F4D35E' } }] }] };
  const zip = kmzDe(doc);
  assert.equal(zip[0], 0x50); assert.equal(zip[1], 0x4B);
  const entradas = leerZip(zip);
  assert.deepEqual(entradas.map(e => e.nombre), ['doc.kml']);
  const texto = new TextDecoder().decode(await entradas[0].datos());
  assert.equal(texto, kmlDe(doc));
  assert.match(texto, /-70\.6,-32\.8 -70\.59,-32\.8 -70\.59,-32\.79 -70\.6,-32\.8/, 'anillo cerrado');
});

test('red de PR: PR nuevos, control y vectores por separado', () => {
  const red = { nombre: 'Red norte', puntos: [{ id: 'a', nombre: 'PR-01', tipo: 'pr', lon: -70.6, lat: -32.8 }, { id: 'b', nombre: 'C-1', tipo: 'control', lon: -70.61, lat: -32.81 }, { id: 'c', nombre: 'PR-02', tipo: 'pr', lon: null, lat: null }], vectores: [['a', 'b'], ['a', 'c']] };
  const c = carpetaRed(red);
  assert.equal(c.nombre, 'Red de PR · Red norte');
  const por = Object.fromEntries(c.carpetas.map(x => [x.nombre, x.elementos.length]));
  assert.deepEqual(por, { 'PR nuevos': 1, 'Puntos de control': 1, Vectores: 1, 'Área': 0 });
});

test('marcas: control y chequeo con su área', () => {
  const c = carpetaMarcas({ nombre: 'Vuelo 1', modo: 'area', area: [[-70.6, -32.8], [-70.59, -32.8], [-70.59, -32.79]], marcas: [{ nombre: 'GCP-01', tipo: 'control', lon: -70.6, lat: -32.8 }, { nombre: 'CHK-01', tipo: 'chequeo', lon: -70.595, lat: -32.795 }] });
  assert.deepEqual(c.carpetas.map(x => x.elementos.length), [1, 1, 1]);
});

test('vuelo: sectores con ha y %, base usada con su altura y base planificada', () => {
  const h = nuevaHoja();
  h.nombre = 'Hoja 1';
  h.area.tipo = 'poligono';
  h.area.original = { nombre: 'área', anillo: [[-70.6, -32.8], [-70.58, -32.8], [-70.58, -32.785], [-70.6, -32.785]] };
  h.area.cortes = [[[-70.59, -32.805], [-70.59, -32.78]]];
  h.resumen = { altura: 120, gsd: 2.5 };
  const g = geometria(h);
  assert.equal(g.sectores.length, 2);
  const proyecto = { capas: { prs: [{ id: 'p1', nombre: 'PR-BASE', lon: -70.59, lat: -32.79, usar: true }] } };
  const amarre = calcularAmarreHoja(h, g, proyecto, []);
  const avance = [{ hojaId: 'x', sector: 'S1', fecha: '2026-11-20', pct: 100, base: 'PR-BASE', alturaBase: 1.8, creadoEn: '2026-11-20T15:00:00Z' }, { hojaId: 'x', sector: 'S2', fecha: '2026-11-21', pct: 50, base: 'PR-BASE', alturaBase: '', creadoEn: '2026-11-21T15:00:00Z' }];
  const c = carpetaVuelo(h, { avance, amarre, geo: g });
  assert.equal(c.nombre, 'Vuelo · Hoja 1');
  assert.match(c.descripcion, /Altura de vuelo: 120 m/);
  assert.match(c.descripcion, /Avance: 75 %/);
  const [sectores, bases] = c.carpetas;
  assert.match(sectores.nombre, /^Sectores \(2\)/);
  assert.equal(sectores.elementos[0].datos['Completado (%)'], 100);
  assert.equal(sectores.elementos[0].datos['Base usada'], 'PR-BASE');
  assert.equal(sectores.elementos[0].datos['Altura de la base (m)'], '1,80');
  assert.equal(sectores.elementos[0].datos['Base planificada'], 'PR-BASE');
  assert.match(sectores.elementos[1].nombre, /S2 · .* ha · 50 %/);
  assert.equal(bases.elementos.length, 1);
  assert.equal(bases.elementos[0].datos['Usada en'], 'S1, S2');
  assert.equal(bases.elementos[0].datos['Altura de la base (m)'], '1,80');
  assert.ok(kmlDe({ nombre: 'v', carpetas: [c] }).includes('<Polygon>'));
});

test('proyecto completo: una carpeta por parte, sin las vacías', () => {
  const doc = documentoProyecto({ nombre: 'Canal', mandante: 'Mandante', capas: { areas: [{ nombre: 'Área', anillo: [[-70.6, -32.8], [-70.59, -32.8], [-70.59, -32.79]], ha: 10 }] } },
    { monografias: [{ nombre: 'PR-1', lat: -32.8, lon: -70.6, cota: '812,41' }, { nombre: 'PR-2' }] });
  assert.deepEqual(doc.carpetas.map(c => c.nombre), ['Capas del proyecto', 'Monografías']);
  assert.equal(carpetaMonografias([{ nombre: 'PR-1', lat: -32.8, lon: -70.6 }, { nombre: 'PR-2' }]).elementos.length, 1);
  const k = kmlDe(doc);
  const leidos = leerCapaSinDom(k);
  assert.ok(leidos >= 2);
});

// leerCapa usa DOMParser (navegador): aquí basta contar los Placemark escritos.
function leerCapaSinDom(k) { void leerCapa; return (k.match(/<Placemark>/g) || []).length; }
