// v0.21.5 · un solo decimal (punto), «Zona 17 Sur», etiquetas y ubicación por país.
import test from 'node:test';
import assert from 'node:assert/strict';
import { efectiva, zonaLegible, unirSinRepetir, paisDe, etiquetasUbicacion, chequeoFicha, PAIS_POR_CODIGO } from '../modulos/monografias/comun.js';
import { escribirGrados, leerGrados, puntoDecimal } from '../modulos/monografias/coordenadas.js';
import { limpiarProvincia } from '../modulos/vuelos/ubicacion.js';

test('geográficas con punto decimal (antes coma) y se siguen leyendo', () => {
  const lat = escribirGrados(-5.143313, 'lat', 'dms', 5);
  assert.equal(lat, `5°08'35.92680" S`);
  assert.ok(!lat.includes(','));
  assert.equal(escribirGrados(-81.1441, 'lon', 'dd', 4), '-81.1441°');
  assert.ok(Math.abs(leerGrados(lat) + 5.143313) < 1e-6);
  assert.equal(puntoDecimal(`5°08'35,92270" S`), `5°08'35.92270" S`);
  assert.equal(puntoDecimal('9431492.393'), '9431492.393');
});

test('el PDF recibe un solo criterio decimal y la zona escrita completa', () => {
  const e = efectiva({ latitud: `5°08'35,92270" S`, longitud: `81°08'38,82922" O`, norte: '9431492.393', zonaUTM: '17s' });
  assert.equal(e.latitud, `5°08'35.92270" S`);
  assert.equal(e.longitud, `81°08'38.82922" O`);
  assert.equal(e.norte, '9431492.393');
  assert.equal(e.zonaUTM, '17 Sur');
});

test('huso legible', () => {
  assert.equal(zonaLegible('17s'), '17 Sur');
  assert.equal(zonaLegible('19 S'), '19 Sur');
  assert.equal(zonaLegible('17 S (Juan Fernández)'), '17 Sur (Juan Fernández)');
  assert.equal(zonaLegible('30 N'), '30 Norte');
  assert.equal(zonaLegible('17 Sur'), '17 Sur');
  assert.equal(zonaLegible(''), '');
});

test('etiquetas según el país; sin país se asume Chile', () => {
  assert.equal(paisDe({}), 'Chile');
  assert.deepEqual(etiquetasUbicacion('Chile'), { comuna: 'Comuna', provincia: '', region: 'Región' });
  assert.deepEqual(etiquetasUbicacion('Perú'), { comuna: 'Distrito', provincia: 'Provincia', region: 'Departamento' });
  assert.equal(etiquetasUbicacion('Bolivia').region, 'Departamento');
  assert.equal(etiquetasUbicacion('Argentina').region, 'Provincia');
  assert.ok(etiquetasUbicacion('Otro lugar').comuna);
  assert.equal(PAIS_POR_CODIGO.PE, 'Perú');
});

test('Perú: distrito + provincia en la ubicación impresa, sin repetir', () => {
  assert.equal(unirSinRepetir(['Paita', 'Paita']), 'Paita');
  assert.equal(unirSinRepetir(['Sullana', ' Piura ', '']), 'Sullana, Piura');
  const igual = efectiva({ pais: 'Perú', comuna: 'Paita', provincia: 'Paita', region: 'Piura' });
  assert.equal(igual.comuna, 'Paita');
  const distinta = efectiva({ pais: 'Perú', comuna: 'Marcavelica', provincia: 'Sullana', region: 'Piura' });
  assert.equal(distinta.comuna, 'Marcavelica, Sullana');
  assert.equal(distinta.region, 'Piura');
  // Chile no usa provincia: queda como estaba
  const cl = efectiva({ comuna: 'Los Andes', provincia: 'Los Andes', region: 'Valparaíso' });
  assert.equal(cl.comuna, 'Los Andes');
  assert.equal(limpiarProvincia('Provincia de Paita'), 'Paita');
  assert.equal(limpiarProvincia('Provincia del Santa'), 'Santa');
});

test('el chequeo nombra la división según el país', () => {
  const comun = { todas: {} };
  const filaDe = f => chequeoFicha(f, [], comun).find(r => /\(confirmar\)|^(Comuna|Distrito|Municipio|Departamento)$/.test(r.k));
  assert.equal(filaDe({ comuna: 'Paita', pais: 'Perú', modulos: {} }).k, 'Distrito');
  assert.equal(filaDe({ comuna: 'Paita', pais: 'Perú', comunaEstimada: true, modulos: {} }).k, 'Distrito (confirmar)');
  assert.equal(filaDe({ comuna: 'Los Andes', modulos: {} }).k, 'Comuna');
});
