// modulos/vuelos/formatos.js — caminos (líneas) desde KML/KMZ, Shapefile, GeoJSON y GPX (v0.11.1).
// Sin librerías. El shapefile puede venir comprimido (.zip con .shp, .dbf y .prj) o como archivos sueltos
// seleccionados juntos. Las coordenadas proyectadas (UTM u otra Transversal de Mercator) se pasan a geográficas
// WGS84 con los parámetros del .prj; sin .prj se asume WGS84 o, si son metros, UTM 19 Sur (se avisa).

import { leerArchivo, leerZip, analizarKml } from './kml.js';

export const FORMATOS_CAMINO = '.kml,.kmz,.zip,.shp,.dbf,.prj,.cpg,.geojson,.json,.gpx';

/** archivos: FileList o arreglo. → { lineas: [{ nombre, linea: [[lon, lat]…] }], aviso } */
export async function lineasDeArchivos(archivos) {
  const lista = [...archivos];
  const shp = lista.find(f => /\.shp$/i.test(f.name));
  if (shp) {
    const par = ext => lista.find(f => f.name.toLowerCase() === shp.name.toLowerCase().replace(/\.shp$/, ext));
    const leerBuf = async f => f ? new Uint8Array(await f.arrayBuffer()) : null;
    const leerTxt = async f => f ? f.text() : '';
    return lineasDeShapefile({ shp: await leerBuf(shp), dbf: await leerBuf(par('.dbf')), prj: await leerTxt(par('.prj')), cpg: await leerTxt(par('.cpg')), nombre: shp.name });
  }
  const out = { lineas: [], aviso: '' };
  for (const f of lista) {
    const r = await lineasDeUnArchivo(f);
    out.lineas.push(...r.lineas);
    if (r.aviso) out.aviso = r.aviso;
  }
  return out;
}

async function lineasDeUnArchivo(f) {
  const nombre = f.name;
  if (/\.(geo)?json$/i.test(nombre)) return { lineas: lineasDeGeoJSON(JSON.parse(await f.text()), nombre) };
  if (/\.gpx$/i.test(nombre)) return { lineas: lineasDeGpx(await f.text(), nombre) };
  if (/\.zip$/i.test(nombre)) {
    const ent = leerZip(new Uint8Array(await f.arrayBuffer()));
    const e = ext => ent.find(x => new RegExp(`\\.${ext}$`, 'i').test(x.nombre) && !/__MACOSX/.test(x.nombre));
    const shp = e('shp');
    if (shp) {
      const base = shp.nombre.replace(/\.shp$/i, '').toLowerCase();
      const par = ext => ent.find(x => x.nombre.toLowerCase() === `${base}.${ext}`) || e(ext);
      const dec = async x => x ? new TextDecoder().decode(await x.datos()) : '';
      return lineasDeShapefile({ shp: await shp.datos(), dbf: par('dbf') ? await par('dbf').datos() : null, prj: await dec(par('prj')), cpg: await dec(par('cpg')), nombre: shp.nombre.split('/').pop() });
    }
    const kml = e('kml');
    if (kml) return { lineas: analizarKml(new TextDecoder().decode(await kml.datos()), nombre).ejes.map(l => ({ nombre: l.nombre || nombre, linea: l.linea })) };
    const gj = e('geojson') || e('json');
    if (gj) return { lineas: lineasDeGeoJSON(JSON.parse(new TextDecoder().decode(await gj.datos())), nombre) };
    throw new Error('El zip no trae un shapefile (.shp), KML ni GeoJSON.');
  }
  if (/\.(dbf|prj|cpg)$/i.test(nombre)) return { lineas: [] };
  return { lineas: analizarKml(await leerArchivo(f), nombre).ejes.map(l => ({ nombre: l.nombre || nombre, linea: l.linea })) };
}

// ─────────── GeoJSON y GPX ───────────

export function lineasDeGeoJSON(json, nombreArchivo = '') {
  const out = [];
  const nom = p => (p && (p.name || p.nombre || p.Name || p.NOMBRE || p.ROL || p.rol)) || nombreArchivo;
  const agregar = (g, nombre) => {
    if (!g) return;
    const c2 = l => l.map(c => [c[0], c[1]]);
    if (g.type === 'LineString') out.push({ nombre, linea: c2(g.coordinates) });
    else if (g.type === 'MultiLineString') g.coordinates.forEach(l => out.push({ nombre, linea: c2(l) }));
    else if (g.type === 'GeometryCollection') g.geometries.forEach(x => agregar(x, nombre));
  };
  if (json.type === 'FeatureCollection') for (const f of json.features || []) agregar(f.geometry, String(nom(f.properties)));
  else if (json.type === 'Feature') agregar(json.geometry, String(nom(json.properties)));
  else agregar(json, nombreArchivo);
  return out.filter(l => l.linea.length >= 2);
}

export function lineasDeGpx(xml, nombreArchivo = '') {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const out = [];
  const pts = (el, tag) => [...el.getElementsByTagNameNS('*', tag)].map(p => [Number(p.getAttribute('lon')), Number(p.getAttribute('lat'))]).filter(c => c.every(isFinite));
  const nom = el => { const n = [...el.children].find(c => c.localName === 'name'); return n ? n.textContent.trim() : nombreArchivo; };
  for (const t of doc.getElementsByTagNameNS('*', 'trk')) for (const seg of t.getElementsByTagNameNS('*', 'trkseg')) out.push({ nombre: nom(t), linea: pts(seg, 'trkpt') });
  for (const r of doc.getElementsByTagNameNS('*', 'rte')) out.push({ nombre: nom(r), linea: pts(r, 'rtept') });
  return out.filter(l => l.linea.length >= 2);
}

// ─────────── Shapefile ───────────

/** { shp: Uint8Array, dbf?, prj?, cpg?, nombre } → { lineas, aviso } */
export function lineasDeShapefile({ shp, dbf, prj, cpg, nombre = '' }) {
  const geoms = leerShp(shp);
  const nombres = dbf ? nombresDbf(dbf, cpg) : [];
  const proy = proyeccionDePrj(prj, geoms);
  const lineas = [];
  geoms.forEach((partes, k) => partes.forEach(pts => {
    if (pts.length >= 2) lineas.push({ nombre: nombres[k] || `${nombre.replace(/\.shp$/i, '')} ${k + 1}`, linea: pts.map(proy.aLonLat) });
  }));
  return { lineas, aviso: proy.aviso };
}

/** Lee las líneas y polígonos (bordes) del .shp → por registro, arreglo de partes [[x, y]…]. */
export function leerShp(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (dv.getInt32(0, false) !== 9994) throw new Error('El .shp no es un shapefile válido.');
  const largo = dv.getInt32(24, false) * 2, tipo = dv.getInt32(32, true);
  if (![3, 5, 13, 15, 23, 25].includes(tipo)) throw new Error('El shapefile no trae líneas: es de puntos u otro tipo.');
  const out = [];
  let p = 100;
  while (p + 8 <= Math.min(largo, buf.length)) {
    const lc = dv.getInt32(p + 4, false) * 2, c = p + 8;
    const t = dv.getInt32(c, true);
    const partes = [];
    if (t !== 0) {
      const nPartes = dv.getInt32(c + 36, true), nPts = dv.getInt32(c + 40, true);
      const ini = [];
      for (let i = 0; i < nPartes; i++) ini.push(dv.getInt32(c + 44 + 4 * i, true));
      const base = c + 44 + 4 * nPartes;
      for (let i = 0; i < nPartes; i++) {
        const a = ini[i], b = i + 1 < nPartes ? ini[i + 1] : nPts, pts = [];
        for (let j = a; j < b; j++) pts.push([dv.getFloat64(base + 16 * j, true), dv.getFloat64(base + 16 * j + 8, true)]);
        partes.push(pts);
      }
    }
    out.push(partes);
    p = c + lc;
  }
  return out;
}

/** Nombre de cada registro desde el .dbf (campo NOMBRE, NAME, ROL, CODIGO… o el primero de texto). */
export function nombresDbf(buf, cpg = '') {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const n = dv.getUint32(4, true), largoCab = dv.getUint16(8, true), largoReg = dv.getUint16(10, true);
  const dec = new TextDecoder(/utf-?8/i.test(cpg) ? 'utf-8' : 'windows-1252');
  const campos = [];
  for (let p = 32, off = 1; p < largoCab - 1 && buf[p] !== 0x0D; p += 32) {
    const nombre = dec.decode(buf.subarray(p, p + 11)).replace(/\0.*$/, '').trim();
    const tipo = String.fromCharCode(buf[p + 11]), largo = buf[p + 16];
    campos.push({ nombre, tipo, off, largo }); off += largo;
  }
  const pref = ['NOMBRE', 'NOMBRE_CAM', 'NAME', 'ROL', 'ROL_LABEL', 'CODIGO', 'COD', 'ID'];
  const campo = pref.map(x => campos.find(c => c.nombre.toUpperCase() === x)).find(Boolean) || campos.find(c => c.tipo === 'C');
  if (!campo) return [];
  const out = [];
  for (let i = 0; i < n; i++) {
    const ini = largoCab + i * largoReg + campo.off;
    out.push(dec.decode(buf.subarray(ini, ini + campo.largo)).trim());
  }
  return out;
}

// ─────────── Proyección (.prj) ───────────

const WGS84 = { a: 6378137, f: 1 / 298.257223563 };

/** Lee el WKT del .prj: geográficas o Transversal de Mercator (UTM incluida). → { aLonLat, aviso } */
export function proyeccionDePrj(prj, geoms = []) {
  const wkt = (prj || '').trim();
  if (wkt && !/PROJCS|PROJCRS/i.test(wkt)) return { aLonLat: p => [p[0], p[1]], aviso: '' };
  let tm = null;
  if (wkt) {
    const par = n => { const m = wkt.match(new RegExp(`PARAMETER\\[\\s*"${n}"\\s*,\\s*(-?[\\d.]+)`, 'i')); return m ? Number(m[1]) : null; };
    const cm = par('central_meridian') ?? par('longitude_of_origin') ?? par('Longitude of natural origin');
    const zona = wkt.match(/UTM[ _]?zone[ _]?(\d{1,2})\s*([NS])?/i);
    if (cm != null) tm = { lon0: cm, k0: par('scale_factor') ?? par('Scale factor at natural origin') ?? 0.9996, fe: par('false_easting') ?? par('False easting') ?? 500000, fn: par('false_northing') ?? par('False northing') ?? 0, lat0: par('latitude_of_origin') ?? 0 };
    else if (zona) tm = utm(Number(zona[1]), (zona[2] || 'S').toUpperCase() === 'S');
    if (!tm) throw new Error('No reconozco la proyección del .prj: exporta el shapefile en WGS84 (geográficas) o en UTM.');
    const aviso = /PSAD|SAD.?69|Provisional_S_American/i.test(wkt) ? 'El shapefile está en PSAD56/SAD69: se convirtió sin cambio de datum (puede desplazarse unos 200 m).' : '';
    return { aLonLat: p => tmInversa(p[0], p[1], tm), aviso };
  }
  // Sin .prj: si los números parecen grados, son geográficas; si no, se asume UTM 19 Sur.
  const p = geoms.flat(2)[0];
  if (!p || (Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90)) return { aLonLat: q => [q[0], q[1]], aviso: '' };
  tm = utm(19, true);
  return { aLonLat: q => tmInversa(q[0], q[1], tm), aviso: 'El shapefile no trae .prj: se asumió UTM 19 Sur (WGS84). Revisa que el camino caiga en su lugar.' };
}

const utm = (zona, sur) => ({ lon0: zona * 6 - 183, k0: 0.9996, fe: 500000, fn: sur ? 10000000 : 0, lat0: 0 });

/** Transversal de Mercator inversa (Snyder, elipsoide WGS84) → [lon, lat] en grados. */
export function tmInversa(x, y, { lon0, k0, fe, fn, lat0 = 0 }) {
  const { a, f } = WGS84, e2 = f * (2 - f), ep2 = e2 / (1 - e2), rad = Math.PI / 180;
  const M = phi => a * ((1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 ** 3 / 256) * phi - (3 * e2 / 8 + 3 * e2 * e2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * phi) + (15 * e2 * e2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * phi) - (35 * e2 ** 3 / 3072) * Math.sin(6 * phi));
  const m = M(lat0 * rad) + (y - fn) / k0;
  const mu = m / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 ** 3 / 256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const phi1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 * e1 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu) + (151 * e1 ** 3 / 96) * Math.sin(6 * mu) + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
  const s = Math.sin(phi1), c = Math.cos(phi1), t = Math.tan(phi1);
  const C1 = ep2 * c * c, T1 = t * t, N1 = a / Math.sqrt(1 - e2 * s * s), R1 = a * (1 - e2) / (1 - e2 * s * s) ** 1.5, D = (x - fe) / (N1 * k0);
  const lat = phi1 - (N1 * t / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4 / 24 + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D ** 6 / 720);
  const lon = lon0 * rad + (D - (1 + 2 * T1 + C1) * D ** 3 / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D ** 5 / 120) / c;
  return [lon / rad, lat / rad];
}
