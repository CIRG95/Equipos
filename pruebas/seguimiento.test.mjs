// pruebas/seguimiento.test.mjs — reglas del módulo Seguimiento (sin navegador).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tramosDesdeCarpetas, estadoCiclo, prepararCambios, gabinete, cuenta, plazoCiclo, mesSiguiente, carpetaMes, revisarArchivos, COLS_VUELO, dmAKm } from '../modulos/seguimiento/modelo.js';

let k = 0; const id = () => `id${++k}`;

test('lee tramos desde nombres de carpeta y rutas', () => {
  const t = tramosDesdeCarpetas('D:\\Codelco RT\\SADDN\\012 Octubre\\003_20+200 - 15+200\n001_10+200 - 4+900\n"002_15+200 - 10+200"\n001_10+200 - 4+900', id);
  assert.equal(t.length, 3);
  assert.deepEqual(t.map(x => x.n), ['001', '002', '003']);
  assert.equal(t[0].nombre, '4+900 – 10+200'); assert.equal(t[0].carpeta, '001_10+200 - 4+900');
  assert.equal(t[2].ini, 15.2); assert.equal(dmAKm('160+000'), 160);
});

test('eventos: el último manda y deshacer vuelve atrás', () => {
  const ev = [];
  const meter = cambios => { const { eventos, inversos } = prepararCambios(estadoCiclo(ev), cambios, { cicloId: 'c', planId: 'p' }); eventos.forEach((e, i) => ev.push({ ...e, creadoEn: `2026-11-02T10:00:0${ev.length + i}Z` })); return inversos; };
  meter([{ tramoId: 'a', tipo: 'terreno', valor: '2026-10-20', por: 'Edgardo' }]);
  meter([{ tramoId: 'a', tipo: 'prod', col: 'np', valor: 'proc' }]);
  const inv = meter([{ tramoId: 'a', tipo: 'prod', col: 'np', valor: 'listo' }]);
  assert.equal(estadoCiclo(ev).a.prod.np, 'listo');
  meter(inv);
  assert.equal(estadoCiclo(ev).a.prod.np, 'proc');
  assert.equal(estadoCiclo(ev).a.por, 'Edgardo');
  assert.equal(prepararCambios(estadoCiclo(ev), [{ tramoId: 'a', tipo: 'prod', col: 'np', valor: 'proc' }], {}).eventos.length, 0, 'sin cambio no hay evento');
});

test('estado de gabinete y conteos', () => {
  const plan = { cols: COLS_VUELO() };
  const est = estadoCiclo([
    { tramoId: 'a', tipo: 'terreno', valor: '2026-10-20', creadoEn: '1' },
    { tramoId: 'b', tipo: 'terreno', valor: '2026-10-20', creadoEn: '1' },
    ...['np', 'mds', 'of', 'kmz'].map(c => ({ tramoId: 'b', tipo: 'prod', col: c, valor: 'listo', creadoEn: '2' })),
    { tramoId: 'c', tipo: 'terreno', valor: '2026-10-20', creadoEn: '1' }, { tramoId: 'c', tipo: 'prod', col: 'np', valor: 'proc', creadoEn: '2' },
    { tramoId: 'd', tipo: 'terreno', valor: 'si', creadoEn: '1' }, ...['np', 'mds', 'of', 'kmz'].map(c => ({ tramoId: 'd', tipo: 'prod', col: c, valor: 'listo', creadoEn: '2' })), { tramoId: 'd', tipo: 'entrega', valor: 'E1', creadoEn: '3' },
  ]);
  assert.equal(gabinete(plan, est.a), 'falta'); assert.equal(gabinete(plan, est.b), 'listo');
  assert.equal(gabinete(plan, est.c), 'proc'); assert.equal(gabinete(plan, est.d), 'ok');
  const c = cuenta(plan, est, [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }]);
  assert.deepEqual([c.sinvolar, c.falta, c.proc, c.listo, c.ok, c.productosListos, c.productos], [1, 1, 1, 1, 1, 8, 20]);
});

test('plazo en días hábiles y dentro de un mes', () => {
  const ciclo = { datos: '2026-10-26' };
  assert.deepEqual(plazoCiclo({ plazo: { tipo: 'habiles', dias: 10 } }, ciclo, '2026-11-02'), { vence: '2026-11-09', quedan: 5 });
  assert.equal(plazoCiclo({ plazo: { tipo: 'mes' } }, ciclo, '2026-11-02').vence, '2026-11-26');
  assert.equal(plazoCiclo({ plazo: { tipo: 'ninguno' } }, ciclo, '2026-11-02'), null);
  assert.ok(plazoCiclo({ plazo: { tipo: 'habiles', dias: 5 } }, ciclo, '2026-11-10').quedan < 0);
});

test('mes siguiente y carpeta del mes', () => {
  assert.deepEqual(mesSiguiente('Octubre 2026', 12), { nombre: 'Noviembre 2026', mesContrato: 13 });
  assert.deepEqual(mesSiguiente('Diciembre 2026', 14), { nombre: 'Enero 2027', mesContrato: 15 });
  assert.equal(carpetaMes({ nombre: 'Octubre 2026', mesContrato: 12 }), '012 Octubre');
});

test('revisar carpeta: marca lo que está y avisa lo que falta', () => {
  const plan = { cols: COLS_VUELO(), areas: [{ carpeta: '01 Línea de impulsión 4+900 - 160+000', tramos: tramosDesdeCarpetas('003_20+200 - 15+200\n008_45+200 - 40+200', id) }] };
  const [t3, t8] = plan.areas[0].tramos;
  const base = '012 Octubre/000. Servicios Permanentes/01 Línea de impulsión 4+900 - 160+000';
  const rutas = [`${base}/003_20+200 - 15+200/MDS 0.5m Octubre 2026_20+200 - 15+200_WGS84 UTM19S EGM08.asc`, `${base}/003_20+200 - 15+200/Ortofoto_Octubre 2026.ECW`, `${base}/008_45+200 - 40+200/Nube.laz`];
  const est = estadoCiclo([{ tramoId: t8.id, tipo: 'terreno', valor: '2026-10-20', creadoEn: '1' }, { tramoId: t8.id, tipo: 'prod', col: 'kmz', valor: 'listo', creadoEn: '1' }]);
  const r = revisarArchivos(plan, est, rutas);
  assert.equal(r.encontrados, 3);
  assert.ok(r.cambios.some(c => c.tramoId === t3.id && c.tipo === 'terreno'), 'tramo con productos queda volado');
  assert.deepEqual(r.cambios.filter(c => c.tipo === 'prod').map(c => c.col).sort(), ['mds', 'np', 'of']);
  assert.equal(r.noEstan.length, 1); assert.equal(r.noEstan[0].col.id, 'kmz');
});
