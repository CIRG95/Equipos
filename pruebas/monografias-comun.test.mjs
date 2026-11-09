import test from 'node:test';
import assert from 'node:assert/strict';
import { nombresDeTexto, leerTabla, numero, utmAGeo, geoAUtm, zonaDe, normalizarComun, avanceComun, efectiva, chequeoFicha, cuenta, datumConvertible } from '../modulos/monografias/comun.js';

test('nombres de fichas en una línea', () => {
  assert.deepEqual(nombresDeTexto('PR-1, PR-2, PR-3'), ['PR-1', 'PR-2', 'PR-3']);
  assert.deepEqual(nombresDeTexto('PR-1 a PR-4'), ['PR-1', 'PR-2', 'PR-3', 'PR-4']);
  assert.deepEqual(nombresDeTexto('M-08..M-10'), ['M-08', 'M-09', 'M-10']);
  assert.deepEqual(nombresDeTexto('BM1\nBM2; BM1'), ['BM1', 'BM2']);
  assert.equal(nombresDeTexto('P1 a P999').length, 200);
});

test('números escritos de distintas formas', () => {
  assert.equal(numero('352100.5'), 352100.5);
  assert.equal(numero('352.100,500'), 352100.5);
  assert.equal(numero('6 972 345,25 m'), 6972345.25);
  assert.equal(numero('6,972,345.25'), 6972345.25);
  assert.equal(numero(''), null);
  assert.equal(numero('abc'), null);
});

test('tabla pegada desde Excel con y sin títulos', () => {
  const sin = leerTabla('PR-1\t352100,5\t6972345,25\t812,4\nPR-2\t352200\t6972400\t815');
  assert.equal(sin.length, 2);
  assert.deepEqual(sin[0], { nombre: 'PR-1', este: 352100.5, norte: 6972345.25, cota: 812.4 });
  const con = leerTabla('Punto;Norte;Este;Cota\nM1;6201000;612000;100');
  assert.deepEqual(con[0], { nombre: 'M1', este: 612000, norte: 6201000, cota: 100 });
});

test('UTM 19 Sur ↔ geográficas como PROJ, ida y vuelta < 1 mm', () => {
  assert.deepEqual(zonaDe('19 S'), { zona: 19, sur: true });
  assert.deepEqual(zonaDe('Huso 18N'), { zona: 18, sur: false });
  const g = utmAGeo(352100.5, 6972345.25, '19 S');
  assert.ok(Math.abs(g.lon - -70.49544261333844) < 1e-6 && Math.abs(g.lat - -27.36413375831127) < 1e-6);
  const u = geoAUtm(g.lat, g.lon, '19 S');
  assert.ok(Math.abs(u.este - 352100.5) < 0.001 && Math.abs(u.norte - 6972345.25) < 0.001, JSON.stringify(u));
  const u2 = geoAUtm(-34.3262324121372, -67.78255372591585, '19S');
  assert.ok(Math.abs(u2.este - 612000) < 0.001 && Math.abs(u2.norte - 6201000) < 0.001);
  assert.ok(datumConvertible('SIRGAS-Chile 2016') && !datumConvertible('PSAD56'));
});

test('datos comunes: formato antiguo, avance y ficha efectiva', () => {
  const c = normalizarComun({ ubicacion: true });
  assert.equal(c.todas.clienteNombre, true);
  c.todas.revisoNombre = false;
  const av = avanceComun(c, [{ clienteNombre: 'Demo' }]);
  assert.equal(av.total, 13);
  assert.ok(av.faltan.includes('Operador') && !av.faltan.includes('Cliente'));
  const f = efectiva({ disposicionImg: 'solo-croquis', clienteLogo: { archivo: 'x' }, modulos: { logoCliente: false } });
  assert.equal(f.modulos.panoramica, false); assert.equal(f.clienteLogo, null);
  const filas = chequeoFicha({ ubicacion: 'Sector norte', comuna: 'Copiapó', comunaEstimada: true }, [{ k: 'Punto', ok: true }], c);
  assert.equal(filas.find(r => r.k === 'Comuna (confirmar)').ok, false);
  assert.equal(filas.find(r => r.k === 'Revisó y fecha').paso, 'ubicacion');
  assert.deepEqual(cuenta(filas), { ok: 2, total: filas.length });
});
