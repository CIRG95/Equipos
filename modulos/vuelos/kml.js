// modulos/vuelos/kml.js — leer, revisar y limpiar polígonos KML/KMZ para DJI Pilot 2.
// Sin librerías: el KMZ (zip) se abre con DecompressionStream del navegador.

import { proyectar, areaM2 } from './calculo.js';

// ─────────── Abrir KML o KMZ ───────────

export async function leerArchivo(archivo) {
  const buf = new Uint8Array(await archivo.arrayBuffer());
  const esZip = buf[0] === 0x50 && buf[1] === 0x4B; // «PK»
  if (!esZip) return new TextDecoder('utf-8').decode(buf);
  return extraerKmlDeZip(buf);
}

async function extraerKmlDeZip(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  // Fin del directorio central: firma 0x06054b50 cerca del final.
  let fin = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  if (fin < 0) throw new Error('El KMZ está dañado: no se encontró el índice del zip.');
  const total = dv.getUint16(fin + 10, true);
  let p = dv.getUint32(fin + 16, true);
  const entradas = [];
  for (let k = 0; k < total; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const metodo = dv.getUint16(p + 10, true);
    const comprimido = dv.getUint32(p + 20, true);
    const largoNombre = dv.getUint16(p + 28, true);
    const largoExtra = dv.getUint16(p + 30, true);
    const largoComent = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const nombre = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + largoNombre));
    entradas.push({ nombre, metodo, comprimido, local });
    p += 46 + largoNombre + largoExtra + largoComent;
  }
  const kml = entradas.find(e => /(^|\/)doc\.kml$/i.test(e.nombre)) || entradas.find(e => /\.kml$/i.test(e.nombre));
  if (!kml) throw new Error('El KMZ no trae ningún archivo .kml adentro.');
  const ini = kml.local + 30 + dv.getUint16(kml.local + 26, true) + dv.getUint16(kml.local + 28, true);
  const datos = buf.subarray(ini, ini + kml.comprimido);
  if (kml.metodo === 0) return new TextDecoder('utf-8').decode(datos);
  if (kml.metodo !== 8) throw new Error('El KMZ usa una compresión que no reconozco.');
  if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador no puede abrir KMZ. Actualiza Chrome o descomprime el KMZ y carga el .kml.');
  const flujo = new Blob([datos]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(flujo).text();
}

// ─────────── Leer geometrías ───────────

const hijos = (el, nombre) => [...el.getElementsByTagNameNS('*', nombre)];
const texto = (el, nombre) => { const x = el.getElementsByTagNameNS('*', nombre)[0]; return x ? x.textContent.trim() : ''; };

function leerCoordenadas(t) {
  return t.trim().split(/\s+/).filter(Boolean).map(c => c.split(',').map(Number)).filter(c => c.length >= 2 && c.every(isFinite));
}

/** Devuelve { poligonos: [...], lineas, puntos, carpetas, error? } */
export function analizarKml(textoKml, nombreArchivo = '') {
  const doc = new DOMParser().parseFromString(textoKml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('El archivo no es un KML válido.');
  const placemarks = hijos(doc, 'Placemark');
  const res = { archivo: nombreArchivo, poligonos: [], lineas: 0, puntos: 0, carpetas: hijos(doc, 'Folder').length, placemarks: placemarks.length };
  let n = 0;
  for (const pm of placemarks) {
    const nombre = texto(pm, 'name') || '';
    const modo = texto(pm, 'altitudeMode');
    for (const pol of hijos(pm, 'Polygon')) {
      const ext = pol.getElementsByTagNameNS('*', 'outerBoundaryIs')[0];
      const coords = ext ? leerCoordenadas(texto(ext, 'coordinates')) : [];
      const hoyos = pol.getElementsByTagNameNS('*', 'innerBoundaryIs').length;
      if (coords.length >= 3) res.poligonos.push(revisar(coords, { nombre: nombre || `Polígono ${++n}`, hoyos, modo, origen: 'poligono' }));
    }
    for (const ls of hijos(pm, 'LineString')) {
      res.lineas++;
      const coords = leerCoordenadas(texto(ls, 'coordinates'));
      // Una polilínea de 3 o más vértices (típica de AutoCAD) puede usarse como polígono cerrándola.
      if (coords.length >= 3) res.poligonos.push(revisar(coords, { nombre: nombre || `Línea ${++n}`, hoyos: 0, modo, origen: 'linea' }));
    }
    res.puntos += hijos(pm, 'Point').length;
  }
  return res;
}

const igual = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;

function revisar(coords, info) {
  const conAltura = coords.some(c => c.length > 2 && c[2] !== 0) || (info.modo && info.modo !== 'clampToGround');
  const cerrado = igual(coords[0], coords[coords.length - 1]);
  let duplicados = 0;
  for (let i = 1; i < coords.length; i++) if (igual(coords[i], coords[i - 1])) duplicados++;
  const anillo = limpiarAnillo(coords);
  const { puntos } = proyectar(anillo);
  const cruces = autoInterseccion(puntos);
  const lonLat = coords.every(c => Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90);
  const problemas = [];
  if (info.origen === 'linea') problemas.push('Es una línea, no un polígono: se cierra al limpiar.');
  if (conAltura) problemas.push('Trae altura o un modo de altitud distinto de «sobre el terreno».');
  if (info.hoyos) problemas.push(`Tiene ${info.hoyos} hoyo${info.hoyos > 1 ? 's' : ''} interior${info.hoyos > 1 ? 'es' : ''}: el control no los usa y se quitan.`);
  if (!cerrado && info.origen === 'poligono') problemas.push('El contorno no está cerrado.');
  if (duplicados) problemas.push(`${duplicados} vértice${duplicados > 1 ? 's' : ''} repetido${duplicados > 1 ? 's' : ''}.`);
  if (anillo.length > 200) problemas.push(`${anillo.length} vértices: muchos para el control; se simplifica.`);
  if (cruces) problemas.push('El contorno se cruza consigo mismo: hay que corregirlo a mano (no se arregla solo).');
  if (!lonLat) problemas.push('Las coordenadas no parecen latitud/longitud (WGS84). ¿Viene en UTM?');
  return { ...info, coords, anillo, vertices: anillo.length, area: areaM2(puntos), conAltura, cerrado, duplicados, cruces, lonLat, problemas };
}

/** Anillo 2D sin repetidos consecutivos y sin el punto de cierre. */
export function limpiarAnillo(coords) {
  const out = [];
  for (const c of coords) { const p = [c[0], c[1]]; if (!out.length || !igual(out[out.length - 1], p)) out.push(p); }
  if (out.length > 1 && igual(out[0], out[out.length - 1])) out.pop();
  return out;
}

function seCruzan(a, b, c, d) {
  const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

export function autoInterseccion(pts) {
  const n = pts.length;
  if (n > 3000) return false; // demasiado grande para revisar rápido; se simplifica primero
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (seCruzan(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) return true;
    }
  }
  return false;
}

// ─────────── Simplificar (Douglas-Peucker en metros) ───────────

function dp(pts, tol) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  let max = 0, idx = 0;
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
  for (let i = 1; i < pts.length - 1; i++) {
    // Si los extremos coinciden (anillo cerrado), se mide la distancia al punto; si no, a la recta.
    const d = L < 1e-9 ? Math.hypot(pts[i][0] - a[0], pts[i][1] - a[1])
      : Math.abs(dy * pts[i][0] - dx * pts[i][1] + b[0] * a[1] - b[1] * a[0]) / L;
    if (d > max) { max = d; idx = i; }
  }
  if (max <= tol) return [a, b];
  return [...dp(pts.slice(0, idx + 1), tol).slice(0, -1), ...dp(pts.slice(idx), tol)];
}

/** Limpia para DJI Pilot 2: un anillo exterior, 2D, sin repetidos, sentido antihorario y ≤ maxVertices. */
export function limpiarParaDji(pol, { maxVertices = 200 } = {}) {
  let anillo = limpiarAnillo(pol.coords);
  const { puntos, lat0, lon0 } = proyectar(anillo);
  let tolerancia = 0;
  let simplificado = puntos;
  if (puntos.length > maxVertices) {
    tolerancia = 0.05;
    const cerrado = [...puntos, puntos[0]];
    while (simplificado.length > maxVertices && tolerancia < 50) {
      const prueba = dp(cerrado, tolerancia).slice(0, -1);
      if (prueba.length < 3) break;
      simplificado = prueba;
      tolerancia *= 1.5;
    }
    const k = Math.cos(lat0 * Math.PI / 180) * 111320;
    anillo = simplificado.map(([x, y]) => [lon0 + x / k, lat0 + y / 110540]);
  }
  // Sentido antihorario (lo que pide KML para el contorno exterior)
  if (firmaArea(anillo) < 0) anillo = anillo.slice().reverse();
  return { ...pol, anillo, vertices: anillo.length, toleranciaM: tolerancia ? tolerancia / 1.5 : 0, verticesOriginales: pol.vertices };
}

function firmaArea(r) {
  let s = 0;
  for (let i = 0; i < r.length; i++) s += r[i][0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * r[i][1];
  return s / 2;
}

const escXml = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

/** KML mínimo con un solo polígono, como el que exporta Google Earth (lo lee DJI Pilot 2). */
export function kmlDePoligono(nombre, anillo) {
  const coords = [...anillo, anillo[0]].map(([lon, lat]) => `${lon.toFixed(8)},${lat.toFixed(8)},0`).join(' ');
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
<name>${escXml(nombre)}</name>
<Placemark>
<name>${escXml(nombre)}</name>
<Polygon>
<altitudeMode>clampToGround</altitudeMode>
<outerBoundaryIs><LinearRing><coordinates>${coords}</coordinates></LinearRing></outerBoundaryIs>
</Polygon>
</Placemark>
</Document>
</kml>
`;
}

export function nombreArchivoSeguro(t) {
  return (String(t || 'area').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') || 'area').slice(0, 60);
}
