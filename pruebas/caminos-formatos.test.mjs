// pruebas/caminos-formatos.test.mjs — caminos desde shapefile (UTM → WGS84) y GeoJSON (v0.11.1).
// Valores de control calculados con PROJ (EPSG:32719 → EPSG:4326).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmInversa, lineasDeShapefile, lineasDeGeoJSON, proyeccionDePrj } from '../modulos/vuelos/formatos.js';

const UTM19S = { lon0: -69, k0: 0.9996, fe: 500000, fn: 10000000 };
const cerca = (a, b, tol = 1e-6) => Math.abs(a - b) < tol;

test('UTM 19 Sur → geográficas como PROJ (< 0,1 m)', () => {
  const [lon, lat] = tmInversa(352100.5, 6972345.25, UTM19S);
  assert.ok(cerca(lon, -70.49544261333844), lon); assert.ok(cerca(lat, -27.36413375831127), lat);
  const [lon2, lat2] = tmInversa(612000, 6201000, UTM19S);
  assert.ok(cerca(lon2, -67.78255372591585), lon2); assert.ok(cerca(lat2, -34.3262324121372), lat2);
});

/** Shapefile mínimo de líneas (tipo 3) con un .dbf de un campo NOMBRE. */
function shapefile(lineas, nombres) {
  const recs = lineas.map(pts => { const b = new ArrayBuffer(8 + 44 + 4 + 16 * pts.length), dv = new DataView(b);
    dv.setInt32(4, (b.byteLength - 8) / 2, false); dv.setInt32(8, 3, true); dv.setInt32(44, 1, true); dv.setInt32(48, pts.length, true); dv.setInt32(52, 0, true);
    pts.forEach((p, j) => { dv.setFloat64(56 + 16 * j, p[0], true); dv.setFloat64(64 + 16 * j, p[1], true); }); return new Uint8Array(b); });
  const total = 100 + recs.reduce((s, r) => s + r.length, 0), shp = new Uint8Array(total), dv = new DataView(shp.buffer);
  dv.setInt32(0, 9994, false); dv.setInt32(24, total / 2, false); dv.setInt32(28, 1000, true); dv.setInt32(32, 3, true);
  let p = 100; for (const r of recs) { shp.set(r, p); p += r.length; }
  const largo = 20, cab = 32 + 32 + 1, dbf = new Uint8Array(cab + nombres.length * (1 + largo)), dd = new DataView(dbf.buffer);
  dd.setUint32(4, nombres.length, true); dd.setUint16(8, cab, true); dd.setUint16(10, 1 + largo, true);
  dbf.set(new TextEncoder().encode('NOMBRE'), 32); dbf[43] = 67; dbf[48] = largo; dbf[64] = 0x0D;
  nombres.forEach((n, i) => { const o = cab + i * (1 + largo); dbf[o] = 32; dbf.set(new TextEncoder().encode(n.padEnd(largo)), o + 1); });
  return { shp, dbf };
}

test('shapefile en UTM 19S con .prj y nombres del .dbf', () => {
  const { shp, dbf } = shapefile([[[352100.5, 6972345.25], [353000, 6973000]], [[612000, 6201000], [612500, 6201500], [613000, 6201200]]], ['Huella norte', 'Acceso sur']);
  const prj = 'PROJCS["WGS_1984_UTM_Zone_19S",GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["False_Easting",500000.0],PARAMETER["False_Northing",10000000.0],PARAMETER["Central_Meridian",-69.0],PARAMETER["Scale_Factor",0.9996],PARAMETER["Latitude_Of_Origin",0.0],UNIT["Meter",1.0]]';
  const r = lineasDeShapefile({ shp, dbf, prj, nombre: 'caminos.shp' });
  assert.equal(r.lineas.length, 2);
  assert.deepEqual(r.lineas.map(l => l.nombre), ['Huella norte', 'Acceso sur']);
  assert.equal(r.lineas[1].linea.length, 3);
  assert.ok(cerca(r.lineas[0].linea[0][0], -70.49544261333844) && cerca(r.lineas[0].linea[0][1], -27.36413375831127));
  assert.equal(r.aviso, '');
});

test('shapefile sin .prj en metros: asume UTM 19S y avisa', () => {
  const { shp } = shapefile([[[352100.5, 6972345.25], [353000, 6973000]]], ['x']);
  const r = lineasDeShapefile({ shp, nombre: 'c.shp' });
  assert.match(r.aviso, /UTM 19 Sur/);
  assert.ok(cerca(r.lineas[0].linea[0][1], -27.36413375831127));
});

test('.prj con zona UTM por nombre (sin parámetros)', () => {
  const p = proyeccionDePrj('PROJCRS["WGS 84 / UTM zone 18S"]');
  const [lon] = p.aLonLat([500000, 6000000]);
  assert.ok(cerca(lon, -75));
});

test('GeoJSON: líneas y multilíneas con su nombre', () => {
  const l = lineasDeGeoJSON({ type: 'FeatureCollection', features: [
    { type: 'Feature', properties: { name: 'Camino A' }, geometry: { type: 'LineString', coordinates: [[-70, -27, 100], [-70.1, -27.1, 120]] } },
    { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: [[[-70, -27], [-70.2, -27]], [[-70, -27], [-70, -27.3]]] } },
    { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [-70, -27] } },
  ] }, 'caminos.geojson');
  assert.equal(l.length, 3);
  assert.equal(l[0].nombre, 'Camino A'); assert.deepEqual(l[0].linea[0], [-70, -27]);
  assert.equal(l[1].nombre, 'caminos.geojson');
});

// v0.11.1 · recorte y simplificación de caminos (para que la red vial y los shapefiles grandes no peguen la app).
import { recortarLinea, simplificarLL } from '../modulos/vuelos/redvial.js';

test('recorta al recuadro: deja solo los tramos que entran (con un vértice de más a cada lado)', () => {
  const linea = Array.from({ length: 21 }, (_, k) => [-71 + k * 0.1, -30]); // de -71 a -69
  const partes = recortarLinea(linea, [-70.25, -30.1, -69.75, -29.9], 0);
  assert.equal(partes.length, 1);
  assert.ok(partes[0][0][0] <= -70.25 && partes[0].at(-1)[0] >= -69.75);
  assert.ok(partes[0].length <= 8);
  assert.deepEqual(recortarLinea(linea, [-60, -10, -59, -9]), []);
});

test('simplifica una línea casi recta y conserva los quiebres', () => {
  const recta = Array.from({ length: 500 }, (_, k) => [-70 + k * 1e-4, -30 + (k % 2) * 1e-6]);
  assert.equal(simplificarLL(recta, 0.00003).length, 2);
  const quiebre = [[-70, -30], [-69.99, -30], [-69.99, -29.99]];
  assert.equal(simplificarLL(quiebre, 0.00003).length, 3);
});
