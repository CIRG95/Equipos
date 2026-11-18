import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularAmarre, jornadasPorBaterias, alcance, esNombreGenerico } from '../modulos/vuelos/amarre.js';

// Caso parecido al de Camilo (17-nov): 8 sectores en tres zonas y 11 PR instalados; con 5 km bastan 3 bases.
const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const S = [
  rect(0, 0, 2200, 3000),        // S1  zona centro
  rect(5000, 0, 2500, 3000),     // S2  zona este
  rect(5000, -3500, 2500, 3000), // S3  zona este
  rect(7800, 0, 2500, 3000),     // S4  zona este
  rect(-5000, -3500, 2500, 3000),// S5  zona centro
  rect(-2500, -3500, 2500, 3000),// S6  zona centro
  rect(-2500, 4000, 2000, 3000), // S7  zona norte
  rect(-5000, 4000, 2400, 3000), // S8  zona norte
];
const pr = (id, x, y) => ({ id, nombre: id, xy: [x, y] });
const PRS = [
  pr('PR1', -2600, 5500), pr('PR2', -1000, 1500), pr('PR3', -1500, -6000), pr('PR4', 3000, 6500), pr('PR5', 3500, 3500),
  pr('PR6', 7600, -300), pr('PR7', 6000, -7000), pr('PR8', 6500, -9000), pr('PR9', 3500, 4800), pr('PR10', 9500, 6000), pr('PR11', -1200, -400),
];

test('alcance = distancia al punto más lejano del sector', () => {
  assert.equal(alcance(rect(0, 0, 300, 400), [0, 0]), 500);
});

test('elige la menor cantidad de PR base que cubre todos los sectores (caso de 3 bases)', () => {
  const a = calcularAmarre({ sectores: S, prs: PRS, radioKm: 5 });
  assert.equal(a.minimas, 3);
  assert.equal(a.nuevos, 0);
  assert.deepEqual(a.sinCubrir, []);
  const grupo = id => a.bases.find(b => b.id === id).sectores.map(i => `S${i + 1}`).sort();
  assert.deepEqual(a.bases.map(b => b.id).sort(), ['PR1', 'PR11', 'PR6']);
  assert.deepEqual(grupo('PR6'), ['S2', 'S3', 'S4']);
  assert.deepEqual(grupo('PR11'), ['S1', 'S5', 'S6']);
  assert.deepEqual(grupo('PR1'), ['S7', 'S8']);
  assert.ok(a.bases.every(b => b.maxDist <= 5000));
});

test('con radio más corto hacen falta más bases', () => {
  const a = calcularAmarre({ sectores: S, prs: PRS, radioKm: 3.5 });
  assert.ok(a.bases.length > 3);
});

test('sector sin PR cercano: sugiere un PR nuevo sobre el camino', () => {
  const lejos = rect(30000, 0, 2000, 2000);
  const camino = [[25000, -5000], [33000, -1000]];
  const a = calcularAmarre({ sectores: [...S, lejos], prs: PRS, caminos: [camino], radioKm: 5 });
  assert.equal(a.nuevos, 1);
  const nuevo = a.bases.find(b => b.nuevo);
  assert.deepEqual(nuevo.sectores, [8]);
  assert.ok(nuevo.aCamino < 1, 'el PR nuevo queda sobre el camino');
  assert.ok(nuevo.maxDist <= 5000);
});

test('el cambio manual de base manda y avisa si queda fuera del radio', () => {
  const a = calcularAmarre({ sectores: S, prs: PRS, radioKm: 5, asignado: { 6: 'PR6' } });
  assert.equal(a.porSector[6].base, 'PR6');
  assert.equal(a.porSector[6].manual, true);
  assert.equal(a.porSector[6].fuera, true);
  assert.deepEqual(a.sinCubrir, [6]);
});

test('sin PR ni caminos: propone un PR nuevo por zona', () => {
  const a = calcularAmarre({ sectores: [rect(0, 0, 1000, 1000), rect(1500, 0, 1000, 1000)], prs: [], radioKm: 5 });
  assert.equal(a.bases.length, 1);
  assert.ok(a.bases[0].nuevo);
});

test('nombres genéricos de Google Earth no se toman como PR', () => {
  assert.equal(esNombreGenerico('Marcador sin título'), true);
  assert.equal(esNombreGenerico(''), true);
  assert.equal(esNombreGenerico('PR11'), false);
});

const sec = (i, vuelos, minTotal) => ({ i, vuelos, minTotal });

test('jornadas por baterías: 4 baterías por día, grupos por base', () => {
  const secs = [sec(0, 2, 60), sec(1, 2, 60), sec(2, 3, 90)];
  const j = jornadasPorBaterias(secs, [[0, 1], [2]], { baterias: 4, minBase: 20, traslado: 10 }, 540);
  assert.equal(j.dias.length, 2);
  assert.deepEqual(j.dias[0].sectores, [0, 1]);
  assert.deepEqual(j.dias[1].sectores, [2]);
  assert.equal(j.dias[0].baterias, 4);
  assert.equal(j.dias[0].min, 20 + 60 + 10 + 60);
});

test('con recarga caben dos bloques en el día', () => {
  const secs = [sec(0, 4, 120), sec(1, 4, 120)];
  const sin = jornadasPorBaterias(secs, [[0, 1]], { baterias: 4, recarga: false }, 600);
  const con = jornadasPorBaterias(secs, [[0, 1]], { baterias: 4, recarga: true, minIdaVuelta: 40, minCarga: 90, minAlmuerzo: 60 }, 600);
  assert.equal(sin.dias.length, 2);
  assert.equal(con.dias.length, 1);
  assert.deepEqual(con.dias[0].bloques, [4, 4]);
  assert.equal(con.dias[0].min, 20 + 120 + 130 + 120);
});

test('un sector más grande que las baterías del día queda repartido y marcado', () => {
  const j = jornadasPorBaterias([sec(0, 6, 180)], null, { baterias: 4 }, 540);
  assert.equal(j.dias.length, 2);
  assert.deepEqual(j.dias[0].parciales, [0]);
  assert.deepEqual(j.dias.map(d => d.baterias), [4, 2]);
});

test('el horario también limita la jornada', () => {
  const j = jornadasPorBaterias([sec(0, 4, 400)], null, { baterias: 4, minBase: 0 }, 250);
  assert.ok(j.dias.length >= 2);
  assert.ok(j.dias.every(d => d.min <= 250 || d.baterias === 1));
});

test('un sector más grande que el radio se marca para dividirlo', () => {
  const largo = rect(0, 0, 2000, 16000);
  const a = calcularAmarre({ sectores: [largo], prs: [pr('A', 1000, 8000)], radioKm: 5 });
  assert.deepEqual(a.grandes, [0]);
  assert.deepEqual(a.sinCubrir, [0]);
});

test('la lista de baterías de cada día dice qué batería de qué sector se vuela', () => {
  const j = jornadasPorBaterias([sec(0, 6, 180)], null, { baterias: 4 }, 540);
  assert.deepEqual(j.dias[1].lista, [{ i: 0, b: 4 }, { i: 0, b: 5 }]);
});
