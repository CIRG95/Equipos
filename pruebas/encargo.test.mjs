import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calidadEncargo, sugerirCronograma, resumenCronograma, barraActividad, rangoProyecto, seCruzan, pendientesEncargo, infoPendiente, sinAcuse, entradasAbiertas, INFO_ENCARGO } from '../app/encargo.js';

const completo = {
  id: 'p1', nombre: 'Canal Norte', mandante: 'Aguas del Valle', tiposTrabajo: ['dron', 'gnss'], comuna: 'Los Andes',
  alcance: 'Red de 12 PR y vuelo fotogramétrico de 180 ha', entregablesPedidos: 'Ortofoto, monografías', plazo: '2026-12-18',
  cronograma: [{ id: 'a1', nombre: 'Terreno', desde: '2026-12-01', hasta: '2026-12-05' }], encargadoId: 'u1', cuadrilla: ['u1', 'u2'],
  encargo: { info: Object.fromEntries(INFO_ENCARGO.map(([k]) => [k, 'si'])) },
};

test('calidad del encargo: completo = 100 % y un encargo solo con nombre queda bajo', () => {
  assert.equal(calidadEncargo(completo).pct, 100);
  assert.deepEqual(calidadEncargo(completo).faltan, []);
  const pobre = calidadEncargo({ nombre: 'Trabajo urgente' });
  assert.ok(pobre.pct < 15, `esperaba menos de 15 %, obtuvo ${pobre.pct}`);
  assert.ok(pobre.faltan.includes('Plazo de entrega'));
});

test('calidad del encargo: «no aplica» cuenta como resuelto y «pendiente» no', () => {
  const p = { ...completo, encargo: { info: { ...completo.encargo.info, accesos: 'na', seguridad: 'pend' } } };
  const c = calidadEncargo(p);
  assert.equal(c.puntos, c.total - 1);
  assert.deepEqual(infoPendiente(p).filter(x => x.declarada).map(x => x.k), ['seguridad']);
});

test('un servicio recurrente no exige plazo único', () => {
  const p = { ...completo, plazo: '', periodicidad: { tipo: 'recurrente' } };
  assert.equal(calidadEncargo(p).pct, 100);
});

test('cronograma sugerido: cubre del inicio al plazo, en orden y sin salirse', () => {
  const c = sugerirCronograma(['dron'], '2026-12-01', '2026-12-20');
  assert.equal(c[0].desde, '2026-12-01');
  assert.equal(c[c.length - 1].hasta, '2026-12-20');
  assert.equal(c[c.length - 1].nombre, 'Entrega al mandante');
  for (let i = 0; i < c.length; i++) {
    assert.ok(c[i].desde <= c[i].hasta, `actividad ${i} con fechas invertidas`);
    assert.ok(c[i].desde >= '2026-12-01' && c[i].hasta <= '2026-12-20');
    if (i) assert.ok(c[i].desde >= c[i - 1].desde, 'las actividades avanzan en el tiempo');
  }
  assert.ok(c.some(a => a.nombre === 'Vuelos en terreno'));
});

test('cronograma sugerido: plazo de un solo día y fechas inválidas', () => {
  const uno = sugerirCronograma(['nivelacion'], '2026-12-01', '2026-12-01');
  assert.ok(uno.length > 0 && uno.every(a => a.desde === '2026-12-01' && a.hasta === '2026-12-01'));
  assert.deepEqual(sugerirCronograma(['dron'], '2026-12-10', '2026-12-01'), []);
  assert.deepEqual(sugerirCronograma(['dron'], '', '2026-12-01'), []);
});

test('resumen del cronograma: avance, atrasadas y actividad en curso', () => {
  const cr = [
    { id: 'a', nombre: 'Terreno', desde: '2026-11-02', hasta: '2026-11-06', hecho: true },
    { id: 'b', nombre: 'Proceso', desde: '2026-11-09', hasta: '2026-11-13', hecho: false },
    { id: 'c', nombre: 'Entrega', desde: '2026-11-16', hasta: '2026-11-20', hecho: false },
  ];
  const r = resumenCronograma(cr, '2026-11-17');
  assert.deepEqual([r.desde, r.hasta, r.dias, r.hechas, r.total, r.pct], ['2026-11-02', '2026-11-20', 19, 1, 3, 33]);
  assert.deepEqual(r.atrasadas.map(a => a.id), ['b']);
  assert.equal(r.actual.id, 'c');
  assert.equal(resumenCronograma([]).total, 0);
});

test('barra de una actividad dentro del rango', () => {
  const b = barraActividad({ desde: '2026-11-06', hasta: '2026-11-10' }, '2026-11-01', '2026-11-10');
  assert.equal(b.izq, 50);
  assert.equal(b.ancho, 50);
});

test('rango del proyecto: cronograma, o encargo → plazo; cruces de fechas', () => {
  assert.deepEqual(rangoProyecto(completo), { desde: '2026-12-01', hasta: '2026-12-05' });
  assert.deepEqual(rangoProyecto({ fechaEncargo: '2026-11-01', plazo: '2026-11-30' }), { desde: '2026-11-01', hasta: '2026-11-30' });
  assert.equal(rangoProyecto({}), null);
  assert.equal(seCruzan({ desde: '2026-11-01', hasta: '2026-11-10' }, { desde: '2026-11-10', hasta: '2026-11-12' }), true);
  assert.equal(seCruzan({ desde: '2026-11-01', hasta: '2026-11-09' }, { desde: '2026-11-10', hasta: '2026-11-12' }), false);
});

test('pendientes: el encargado debe acusar recibo y quien encargó debe responder y confirmar', () => {
  const p = {
    ...completo, encargo: { ...completo.encargo, emitidoPor: 'jefe', emitidoEn: '2026-11-16T12:00:00Z', recibidoEn: null },
    bitacora: [
      { id: 'b1', tipo: 'consulta', texto: '¿Cuál es el huso?', por: 'u1', en: '2026-11-16T13:00:00Z' },
      { id: 'b2', tipo: 'llamada', texto: 'Se pide ampliar el área', por: 'u1', en: '2026-11-16T14:00:00Z' },
      { id: 'b3', tipo: 'acuerdo', texto: 'Entrega parcial el viernes', por: 'jefe', en: '2026-11-16T15:00:00Z' },
    ],
  };
  assert.equal(sinAcuse(p), true);
  assert.equal(entradasAbiertas(p).length, 2);
  const enc = pendientesEncargo({ rol: 'terreno', personaId: 'u1', proyectos: [p], hoy: '2026-11-17' });
  assert.ok(enc.some(x => x.titulo.startsWith('Confirmar que lo recibí')));
  assert.ok(!enc.some(x => x.etiqueta === 'Responder'), 'el encargado no responde su propia consulta');
  const jefe = pendientesEncargo({ rol: 'direccion', personaId: 'jefe', proyectos: [p], hoy: '2026-11-17' });
  assert.deepEqual(jefe.map(x => x.etiqueta).sort(), ['Confirmar', 'Responder', 'Sin confirmar']);
  // Resuelto todo, no quedan pendientes.
  const listo = { ...p, encargo: { ...p.encargo, recibidoEn: '2026-11-16T16:00:00Z', recibidoPor: 'u1' }, bitacora: [{ ...p.bitacora[0], respuesta: '19 S' }, { ...p.bitacora[1], confirmadoEn: '2026-11-16T17:00:00Z' }] };
  assert.deepEqual(pendientesEncargo({ rol: 'direccion', personaId: 'jefe', proyectos: [listo], hoy: '2026-11-17' }), []);
});

test('pendientes: un proyecto propio no pide acuse y los cerrados no generan pendientes', () => {
  const propio = { ...completo, encargo: { emitidoPor: 'u1', emitidoEn: '2026-11-16T12:00:00Z' } };
  assert.equal(sinAcuse(propio), false);
  const cerrado = { ...completo, estado: 'cerrado', encargo: { emitidoPor: 'jefe', emitidoEn: '2026-11-16T12:00:00Z' } };
  assert.deepEqual(pendientesEncargo({ rol: 'terreno', personaId: 'u1', proyectos: [cerrado], hoy: '2026-11-17' }), []);
});
