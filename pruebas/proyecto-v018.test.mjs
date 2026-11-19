// v0.18: un solo KMZ por proyecto (áreas), la red nace del proyecto y el cronograma se arma solo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fusionarCapas, haDeAnillo, areaPrincipal, resumenCapas } from '../modulos/vuelos/capas-proyecto.js';
import { semillaRed, semillaMarcas, puntosDelProyecto, sumarPuntosDelProyecto } from '../modulos/planificacion/desde-proyecto.js';
import { cronogramaSincronizado, cronogramaDeTrabajos } from '../app/trabajos.js';

// Cuadrado ficticio de ~1 km × 1 km cerca de Los Andes
const lat0 = -32.83, lon0 = -70.6, dLat = 1000 / 110540, dLon = 1000 / (Math.cos(lat0 * Math.PI / 180) * 111320);
const cuadrado = [[lon0, lat0], [lon0 + dLon, lat0], [lon0 + dLon, lat0 + dLat], [lon0, lat0 + dLat]];

test('superficie de un anillo en hectáreas', () => {
  assert.ok(Math.abs(haDeAnillo(cuadrado) - 100) < 1, `≈100 ha: ${haDeAnillo(cuadrado)}`);
  assert.equal(haDeAnillo([[0, 0], [1, 1]]), 0);
});

test('las capas guardan áreas, sin repetirlas, y la principal es la más grande', () => {
  const chico = cuadrado.map(([x, y]) => [x + 0.1, y + 0.1 * 0]).map(([x, y], i) => (i === 1 || i === 2 ? [x - dLon / 2, y] : [x, y]));
  const leidas = { archivos: ['proyecto.kmz'], caminos: [], prs: [{ nombre: 'PR1', lon: lon0, lat: lat0 }], areas: [{ nombre: 'Área A', anillo: cuadrado, ha: haDeAnillo(cuadrado) }, { nombre: 'Área B', anillo: chico, ha: haDeAnillo(chico) }] };
  let c = fusionarCapas(null, leidas);
  assert.equal(c.areas.length, 2);
  assert.ok(c.areas.every(a => a.id));
  c = fusionarCapas(c, leidas);
  assert.equal(c.areas.length, 2, 'no repite áreas');
  assert.equal(areaPrincipal(c).nombre, 'Área A');
  assert.match(resumenCapas(c), /^2 áreas de 1\d\d(,\d)? ha · 1 PR$/);
  assert.equal(areaPrincipal(null), null);
});

test('la red nace con el área, los caminos, los PR existentes (control) y los PR nuevos del amarre', () => {
  const p = { id: 'pro-1', capas: { areas: [{ id: 'a1', nombre: 'Área A', anillo: cuadrado, ha: 100 }], caminos: [{ nombre: 'Ruta', linea: [[lon0, lat0], [lon0 + dLon, lat0]] }],
    prs: [{ id: 'p1', nombre: 'PR1', lon: lon0, lat: lat0, usar: true }, { id: 'p2', nombre: 'Marcador sin título', lon: lon0, lat: lat0, usar: false }] } };
  const hojas = [{ id: 'h1', nombre: 'Vuelo 1', resumen: { amarre: { nuevosLL: [{ nombre: 'PR-N1', lon: lon0 + dLon, lat: lat0 + dLat }, { nombre: 'pr1', lon: 0, lat: 0 }] } } }];
  const r = semillaRed(p, hojas);
  assert.equal(r.area, cuadrado);
  assert.match(r.areaNombre, /Área del proyecto/);
  assert.equal(r.caminos.length, 1);
  assert.deepEqual(r.puntos.map(x => [x.nombre, x.tipo]), [['PR1', 'control'], ['PR-N1', 'pr']], 'sin el desactivado ni repetidos por nombre');
  assert.equal(semillaMarcas(p).area, cuadrado);
  assert.equal(semillaRed({ id: 'x' }).area, null);
  // Traer después: solo agrega lo que falta
  const { puntos, agregados } = sumarPuntosDelProyecto({ puntos: [{ nombre: 'PR1', tipo: 'control' }] }, p, hojas);
  assert.equal(agregados, 1);
  assert.equal(puntos.length, 2);
  assert.equal(puntosDelProyecto(null).length, 0);
});

test('cronograma automático: conserva lo realizado y reemplaza lo pendiente', () => {
  const trabajos = [{ cat: 'gnss', dias: 2 }, { cat: 'dron', dias: 3 }];
  const nuevo = cronogramaDeTrabajos(trabajos, '2026-11-16', { plazo: '2026-12-04' });
  const previas = [{ id: 'a1', nombre: 'Estimado de Jefatura', desde: '2026-11-16', hasta: '2026-11-20', hecho: false }, { id: 't-gnss', nombre: 'gnss en terreno', desde: '2026-11-16', hasta: '2026-11-17', hecho: true }];
  const { cronograma, cambio } = cronogramaSincronizado(previas, nuevo);
  assert.equal(cambio, true);
  assert.deepEqual(cronograma.map(a => a.id), ['t-gnss', 't-dron', 't-gabinete']);
  assert.equal(cronograma[0].hecho, true, 'lo realizado no se pierde');
  assert.equal(cronogramaSincronizado(cronograma, nuevo).cambio, false, 'sin cambios no se vuelve a guardar');
  assert.equal(cronogramaSincronizado(previas, []).cambio, false);
});
