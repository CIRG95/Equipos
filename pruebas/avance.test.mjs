// v0.18a: avance de vuelos por sector.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoSectores, totalesAvance, metaDelDia, textoAvance, problemaRegistro } from '../modulos/vuelos/avance.js';

const sectores = [{ nombre: 'S1', ha: 2000 }, { nombre: 'S2', ha: 2000 }, { nombre: 'S3', ha: 1000 }, { nombre: 'S4', ha: 1000 }];
const ev = (sector, fecha, pct, creadoEn = `${fecha}T12:00:00Z`) => ({ id: `${sector}${fecha}${pct}`, hojaId: 'h', sector, fecha, pct, creadoEn });

test('el estado de un sector es su último registro', () => {
  const e = estadoSectores(sectores, [ev('S1', '2026-11-18', 50), ev('S1', '2026-11-19', 100), ev('S2', '2026-11-18', 100, '2026-11-18T10:00:00Z'), ev('S2', '2026-11-18', 75, '2026-11-18T15:00:00Z'), { ...ev('S3', '2026-11-18', 100), eliminadoEn: 'x' }]);
  assert.deepEqual(e.map(x => x.pct), [100, 75, 0, 0]);
  assert.equal(e[0].registros.length, 2);
});

test('totales en sectores (un 50 % suma medio) y en hectáreas', () => {
  const t = totalesAvance(estadoSectores(sectores, [ev('S1', '2026-11-18', 100), ev('S2', '2026-11-18', 50), ev('S3', '2026-11-18', 100)]));
  assert.equal(t.volados, 2.5); assert.equal(t.completos, 2); assert.equal(t.ha, 6000); assert.equal(t.haVoladas, 4000); assert.equal(t.pct, 67); assert.equal(t.terminado, false);
  assert.match(textoAvance(t), /^2,5 de 4 sectores · 4\.000 de 6\.000 ha \(67 %\)$/);
  assert.equal(totalesAvance(estadoSectores(sectores, sectores.map(s => ev(s.nombre, '2026-11-18', 100)))).terminado, true);
  assert.equal(textoAvance(totalesAvance([])), 'Sin sectores');
});

test('meta del día y sectores atrasados según el programa', () => {
  const programa = [{ fecha: '2026-11-18', dia: 1, sectores: ['S1', 'S2'] }, { fecha: '2026-11-19', dia: 2, sectores: ['S3', 'S4'] }];
  const e = estadoSectores(sectores, [ev('S1', '2026-11-18', 100), ev('S2', '2026-11-18', 50), ev('S3', '2026-11-19', 100)]);
  const m = metaDelDia(programa, e, '2026-11-19');
  assert.deepEqual(m.hoy, { dia: 2, sectores: ['S3', 'S4'], listos: ['S3'] });
  assert.deepEqual(m.atrasados, ['S2']);
  assert.equal(m.cumplida, false);
  assert.equal(metaDelDia(programa, e, '2026-11-25').hoy, null);
});

test('validación del registro', () => {
  assert.equal(problemaRegistro({ hojaId: 'h', sector: 'S1', fecha: '2026-11-18', pct: 100, alturaBase: 1.6 }), '');
  assert.match(problemaRegistro({ hojaId: 'h', fecha: '2026-11-18', pct: 100 }), /sector/);
  assert.match(problemaRegistro({ hojaId: 'h', sector: 'S1', fecha: '', pct: 100 }), /fecha/);
  assert.match(problemaRegistro({ hojaId: 'h', sector: 'S1', fecha: '2026-11-18', pct: 120 }), /0 a 100/);
  assert.match(problemaRegistro({ hojaId: 'h', sector: 'S1', fecha: '2026-11-18', pct: 50, alturaBase: 160 }), /metros/);
});
