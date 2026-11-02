// pruebas/metar.test.mjs — lectura del METAR pegado y aeródromos cercanos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fijarEstaciones, cercanas, representatividad, decodificar, decodificarUno, comparar, categoria } from '../modulos/vuelos/metar.js';

fijarEstaciones(JSON.parse(readFileSync(new URL('../vendor/capas/metar-estaciones.json', import.meta.url))).estaciones);
const ahora = new Date('2026-11-02T15:30:00Z');

test('aeródromos con METAR más cercanos', () => {
  const c = cercanas(-32.833, -70.598, 3);
  assert.equal(c[0].icao, 'SCEL'); assert.equal(c.length, 3);
  assert.ok(!representatividad(c[0], 820).buena, 'a 64 km es solo referencia');
  assert.ok(!cercanas(-33.1, -70.7, 5).some(e => e.icao === 'SCPD'), 'Peldehue solo tiene TAF');
  assert.equal(cercanas(-22.33, -68.92, 1)[0].icao, 'SCCF');
});

test('decodifica un METAR típico', () => {
  const m = decodificarUno('METAR SCEL 021400Z 20015G25KT 180V240 9999 FEW030 BKN080 22/08 Q1015 NOSIG=', ahora);
  assert.equal(m.icao, 'SCEL'); assert.equal(m.hora.toISOString(), '2026-11-02T14:00:00.000Z');
  assert.equal(m.viento.dir, 200); assert.ok(Math.abs(m.viento.ms - 7.72) < 0.01); assert.ok(Math.abs(m.viento.rafMs - 12.86) < 0.01);
  assert.equal(m.viento.varDe, 180); assert.equal(m.visibilidadM, 10000);
  assert.equal(m.nubes.length, 2); assert.equal(m.techoPies, 8000); assert.equal(m.temp, 22); assert.equal(m.rocio, 8); assert.equal(m.qnh, 1015);
  assert.equal(m.categoria, 'VFR'); assert.equal(m.tendencia, 'NOSIG');
});

test('niebla, CAVOK, M en temperatura y viento en MPS', () => {
  const f = decodificarUno('SCSN 021000Z 00000KT 0300 FG VV001 M01/M01 Q1020', ahora);
  assert.equal(f.categoria, 'LIFR'); assert.equal(f.fenomenos[0].texto, 'niebla'); assert.equal(f.temp, -1);
  const c = decodificarUno('METAR SCVM 021400Z VRB03KT CAVOK 18/09 Q1016', ahora);
  assert.equal(c.viento.dir, null); assert.ok(c.cavok); assert.equal(c.categoria, 'VFR');
  const p = decodificarUno('METAR SCRD 021400Z 24006MPS 8000 -RA SCT015 BKN025 14/12 Q1012', ahora);
  assert.equal(p.viento.ms, 6); assert.equal(p.fenomenos[0].texto, 'lluvia débil'); assert.equal(p.categoria, 'MVFR');
});

test('texto pegado con varios reportes, resumen de AIP Chile y TAF', () => {
  const t = `METAR SCEL 021300Z 19010KT 9999 FEW030 21/08 Q1016=
Viento de 190 grados a 10 nudos...
METAR SCEL 021400Z 20012KT 9999 FEW030 22/08 Q1015=
TAF SCEL 021100Z 0212/0312 20010KT 9999 FEW030 TEMPO 0218/0222 21015G25KT=`;
  const d = decodificar(t, ahora);
  assert.equal(d.metars.length, 2); assert.equal(d.metars[0].texto.includes('021400Z'), true, 'el más nuevo primero');
  assert.ok(d.taf.startsWith('TAF SCEL'));
});

test('compara con el dron y el pronóstico', () => {
  const m = decodificarUno('METAR SCEL 021400Z 20015G25KT 9999 FEW030 22/08 Q1015', ahora);
  const comp = comparar(m, { vientoMaxMs: 12, rafagaMaxMs: 12 }, { v: 5 });
  assert.equal(comp[0].nivel, 'no', 'ráfaga 12,9 m/s supera 12');
  assert.ok(comp.some(c => /pronóstico decía 5\.0/.test(c.texto)));
  assert.equal(categoria(900, 10000), 'IFR');
});
