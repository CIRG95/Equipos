import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diasHabiles, vacacionesDevengadas, resumenVacaciones, ubicacionPersona, crucesAusencia, ocupacionSemanal, proyectosActivosDe, pendientesAdmin, CONFIG_BASE } from '../modulos/administracion/modelo.js';

const proyectos = [
  { id: 'p1', nombre: 'Canal Norte', encargadoId: 'ana', cuadrilla: ['ana', 'luis'], cronograma: [{ nombre: 'Terreno', desde: '2026-11-16', hasta: '2026-11-27' }] },
  { id: 'p2', nombre: 'Línea 9', encargadoId: 'luis', cuadrilla: [], fechaEncargo: '2026-12-01', plazo: '2026-12-15' },
  { id: 'p3', nombre: 'Cerrado', encargadoId: 'ana', estado: 'cerrado' },
  { id: 'oficina', nombre: 'Oficina', cuadrilla: ['ana'] },
];
const ausencias = [
  { id: 'a1', personaId: 'luis', tipo: 'vacaciones', estado: 'aprobada', desde: '2026-11-23', hasta: '2026-11-27' },
  { id: 'a2', personaId: 'ana', tipo: 'vacaciones', estado: 'solicitada', desde: '2026-11-18', hasta: '2026-11-19' },
  { id: 'a3', personaId: 'ana', tipo: 'vacaciones', estado: 'aprobada', desde: '2026-02-02', hasta: '2026-02-13' },
];

test('días hábiles entre fechas', () => {
  assert.equal(diasHabiles('2026-11-16', '2026-11-20'), 5); // lunes a viernes
  assert.equal(diasHabiles('2026-11-20', '2026-11-23'), 2); // viernes y lunes
  assert.equal(diasHabiles('2026-11-21', '2026-11-22'), 0); // fin de semana
  assert.equal(diasHabiles('2026-11-20', '2026-11-16'), 0);
});

test('vacaciones devengadas: 1,25 días por mes completo', () => {
  assert.equal(vacacionesDevengadas('2025-11-16', '2026-11-16'), 15);
  assert.equal(vacacionesDevengadas('2025-11-17', '2026-11-16'), 13.75);
  assert.equal(vacacionesDevengadas('', '2026-11-16'), 0);
  assert.equal(vacacionesDevengadas('2027-01-01', '2026-11-16'), 0);
});

test('resumen de vacaciones: saldo estimado y saldo registrado', () => {
  const fichas = [{ id: 'ana', contrato: { ingreso: '2024-11-16' } }, { id: 'luis', contrato: { ingreso: '2024-11-16' }, saldoVacaciones: 7 }];
  const ana = resumenVacaciones('ana', { ausencias, fichas, hoy: '2026-11-16' });
  assert.deepEqual([ana.devengadas, ana.tomadas, ana.saldo, ana.estimado, ana.porAprobar], [30, 10, 20, true, 1]);
  assert.equal(ana.proximas[0].id, 'a2');
  const luis = resumenVacaciones('luis', { ausencias, fichas, hoy: '2026-11-16' });
  assert.deepEqual([luis.saldo, luis.estimado], [7, false]);
  assert.equal(resumenVacaciones('otro', { ausencias, fichas, hoy: '2026-11-16' }).saldo, null);
});

test('ubicación de una persona en una fecha', () => {
  const u = (id, fecha) => ubicacionPersona(id, { ausencias, proyectos, fecha });
  assert.equal(u('ana', '2026-11-17').estado, 'proyecto');
  assert.deepEqual(u('ana', '2026-11-17').proyectos.map(p => p.id), ['p1']);
  assert.equal(u('luis', '2026-11-24').estado, 'ausente');
  assert.equal(u('luis', '2026-11-30').estado, 'disponible'); // entre el término de p1 y el inicio de p2
  assert.equal(u('luis', '2026-12-02').proyectos[0].id, 'p2');
  assert.equal(u('ana', '2026-11-18').estado, 'proyecto', 'una ausencia sin aprobar no cuenta como ausente');
  assert.deepEqual(proyectosActivosDe('ana', proyectos).map(p => p.id), ['p1'], 'ni cerrados ni Oficina');
});

test('una ausencia que coincide con un proyecto se advierte', () => {
  assert.deepEqual(crucesAusencia(ausencias[0], proyectos).map(p => p.id), ['p1']);
  assert.deepEqual(crucesAusencia({ personaId: 'luis', desde: '2026-11-28', hasta: '2026-11-30' }, proyectos), []);
});

test('ocupación semanal para la distribución', () => {
  const o = ocupacionSemanal('luis', ['2026-11-16', '2026-11-23', '2026-11-30', '2026-12-07'], { ausencias, proyectos });
  assert.deepEqual(o.map(c => c.proyectos.map(p => p.id).join('+')), ['p1', 'p1', 'p2', 'p2']);
  assert.deepEqual(o.map(c => !!c.ausencia), [false, true, false, false]);
});

test('las solicitudes de ausencia llegan como pendiente a Recursos Humanos y a Jefatura, con el cruce', () => {
  const d = { tipos: [], documentos: [], fichas: [], vehiculos: [], guias: [], mandantes: [], cotizaciones: [], ausencias, config: CONFIG_BASE };
  const personas = [{ id: 'ana', nombre: 'Ana Rojas' }, { id: 'luis', nombre: 'Luis Soto' }];
  for (const rol of ['rrhh', 'direccion']) {
    const pend = pendientesAdmin({ rol, personaId: 'x', d, personas, proyectos, hoy: '2026-11-16' }).filter(x => x.etiqueta === 'Por aprobar');
    assert.equal(pend.length, 1, rol);
    assert.match(pend[0].titulo, /Vacaciones · Ana Rojas/);
    assert.match(pend[0].detalle, /coincide con Canal Norte/);
  }
  assert.deepEqual(pendientesAdmin({ rol: 'terreno', personaId: 'ana', d, personas, proyectos, hoy: '2026-11-16' }).filter(x => x.etiqueta === 'Por aprobar'), []);
});
