// compartido/kmz.js — escribir KML y KMZ en carpetas, sin librerías (Sistema v0.21).
// Lo usan los botones «Exportar KMZ» (red de PR, marcas GCP, vuelo, monografías) y «Exportar el proyecto».
//
// Documento: { nombre, descripcion?, carpetas: [Carpeta], elementos?: [Elemento] }
//   Carpeta:   { nombre, descripcion?, abierta?, elementos: [Elemento], carpetas?: [Carpeta] }
//   Elemento:  { tipo: 'punto' | 'linea' | 'poligono', nombre, descripcion?, datos?: { etiqueta: valor },
//                estilo: { color: '#RRGGBB', relleno?: 0–1, ancho?: px, icono?: 'triangulo'|'circulo'|'cuadrado'|'cruz'|'banderita', escala? },
//                coords: [lon, lat, alt?] (punto) · [[lon, lat]…] (línea o anillo del polígono) }
// Los estilos iguales se escriben una sola vez (<Style id> compartido). Colores KML: aabbggrr.

import { armarZip, nombreSeguro } from './zip.js';
import { descargar } from './util.js';

export const TIPO_KML = 'application/vnd.google-earth.kml+xml';
export const TIPO_KMZ = 'application/vnd.google-earth.kmz';

const ICONOS = {
  triangulo: 'http://maps.google.com/mapfiles/kml/shapes/triangle.png',
  circulo: 'http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png',
  cuadrado: 'http://maps.google.com/mapfiles/kml/shapes/square.png',
  cruz: 'http://maps.google.com/mapfiles/kml/shapes/target.png',
  banderita: 'http://maps.google.com/mapfiles/kml/shapes/flag.png',
};

export function xml(t) {
  return String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
}

/** '#RRGGBB' y opacidad 0–1 → 'aabbggrr' de KML. */
export function colorKml(hex, opacidad = 1) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex || '').trim());
  const [r, g, b] = m ? [m[1], m[2], m[3]] : ['ff', 'ff', 'ff'];
  const a = Math.round(Math.max(0, Math.min(1, Number(opacidad))) * 255).toString(16).padStart(2, '0');
  return `${a}${b}${g}${r}`.toLowerCase();
}

const num = v => {
  const n = Number(v);
  return Number.isFinite(n) ? String(Math.round(n * 1e8) / 1e8) : null;
};
const coordTxt = c => {
  const x = num(c[0]), y = num(c[1]);
  if (x == null || y == null) return null;
  const z = c.length > 2 ? num(c[2]) : null;
  return z == null ? `${x},${y}` : `${x},${y},${z}`;
};
const coordsValidas = cs => (cs || []).map(coordTxt).filter(Boolean);

function claveEstilo(tipo, e = {}) {
  return JSON.stringify([tipo, e.color || '#FFFFFF', e.relleno ?? null, e.ancho ?? null, e.icono || null, e.escala ?? null]);
}

function estiloXml(id, tipo, e = {}) {
  const color = e.color || '#FFFFFF';
  if (tipo === 'punto') {
    const icono = ICONOS[e.icono] || ICONOS.circulo;
    return `<Style id="${id}"><IconStyle><color>${colorKml(color)}</color><scale>${e.escala ?? 1}</scale><Icon><href>${icono}</href></Icon></IconStyle>`
      + `<LabelStyle><scale>0.9</scale></LabelStyle></Style>`;
  }
  const linea = `<LineStyle><color>${colorKml(color)}</color><width>${e.ancho ?? 2}</width></LineStyle>`;
  if (tipo === 'linea') return `<Style id="${id}">${linea}</Style>`;
  const relleno = e.relleno ?? 0.2;
  return `<Style id="${id}">${linea}<PolyStyle><color>${colorKml(color, relleno)}</color><fill>${relleno > 0 ? 1 : 0}</fill><outline>1</outline></PolyStyle></Style>`;
}

function datosXml(datos) {
  const filas = Object.entries(datos || {}).filter(([, v]) => v != null && String(v).trim() !== '');
  if (!filas.length) return '';
  return `<ExtendedData>${filas.map(([k, v]) => `<Data name="${xml(k)}"><value>${xml(v)}</value></Data>`).join('')}</ExtendedData>`;
}

/** Texto de la descripción: lo escrito más los datos como lista (se ve en el globo de Google Earth). */
function descripcionXml(el) {
  const lineas = [];
  if (el.descripcion) lineas.push(String(el.descripcion));
  for (const [k, v] of Object.entries(el.datos || {})) if (v != null && String(v).trim() !== '') lineas.push(`${k}: ${v}`);
  return lineas.length ? `<description>${xml(lineas.join('\n'))}</description>` : '';
}

function geometriaXml(el) {
  if (el.tipo === 'punto') {
    const c = coordTxt(el.coords || []);
    return c ? `<Point><coordinates>${c}</coordinates></Point>` : '';
  }
  const cs = coordsValidas(el.coords);
  if (el.tipo === 'linea') return cs.length >= 2 ? `<LineString><tessellate>1</tessellate><coordinates>${cs.join(' ')}</coordinates></LineString>` : '';
  if (el.tipo === 'poligono') {
    if (cs.length < 3) return '';
    if (cs[0] !== cs[cs.length - 1]) cs.push(cs[0]); // KML pide el anillo cerrado
    return `<Polygon><tessellate>1</tessellate><outerBoundaryIs><LinearRing><coordinates>${cs.join(' ')}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;
  }
  return '';
}

/** Cuenta los elementos con geometría válida de un documento o carpeta (incluye subcarpetas). */
export function contarElementos(c) {
  return (c.elementos || []).filter(e => geometriaXml(e)).length + (c.carpetas || []).reduce((s, x) => s + contarElementos(x), 0);
}

/** KML (texto) del documento. Las carpetas vacías no se escriben. */
export function kmlDe(doc) {
  const estilos = new Map();
  const idEstilo = el => {
    const k = claveEstilo(el.tipo, el.estilo);
    if (!estilos.has(k)) estilos.set(k, { id: `e${estilos.size + 1}`, tipo: el.tipo, estilo: el.estilo || {} });
    return estilos.get(k).id;
  };
  const elementoXml = el => {
    const geo = geometriaXml(el);
    if (!geo) return '';
    return `<Placemark><name>${xml(el.nombre || '')}</name>${descripcionXml(el)}<styleUrl>#${idEstilo(el)}</styleUrl>${datosXml(el.datos)}${geo}</Placemark>`;
  };
  const carpetaXml = c => {
    if (!contarElementos(c)) return '';
    const cuerpo = (c.elementos || []).map(elementoXml).join('') + (c.carpetas || []).map(carpetaXml).join('');
    return `<Folder><name>${xml(c.nombre || 'Carpeta')}</name>${c.abierta ? '<open>1</open>' : ''}${c.descripcion ? `<description>${xml(c.descripcion)}</description>` : ''}${cuerpo}</Folder>`;
  };
  const cuerpo = (doc.elementos || []).map(elementoXml).join('') + (doc.carpetas || []).map(carpetaXml).join('');
  const estilosTxt = [...estilos.values()].map(s => estiloXml(s.id, s.tipo, s.estilo)).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n<Document><name>${xml(doc.nombre || 'Topoland')}</name><open>1</open>`
    + `${doc.descripcion ? `<description>${xml(doc.descripcion)}</description>` : ''}${estilosTxt}${cuerpo}</Document>\n</kml>\n`;
}

/** KMZ (Uint8Array): un zip con doc.kml adentro. */
export function kmzDe(doc, { fecha = new Date() } = {}) {
  return armarZip([{ nombre: 'doc.kml', datos: new TextEncoder().encode(kmlDe(doc)) }], { fecha });
}

/** Blob listo para descargar en el formato pedido ('kmz' o 'kml'). */
export function archivoKmz(doc, formato = 'kmz') {
  return formato === 'kml'
    ? new Blob([kmlDe(doc)], { type: TIPO_KML })
    : new Blob([kmzDe(doc)], { type: TIPO_KMZ });
}

/** Descarga el documento como KMZ (o KML) con un nombre seguro: «<base>_<AAAA-MM-DD>.kmz». Devuelve los elementos escritos. */
export function descargarDocumento(doc, base, formato = 'kmz', hoy = new Date().toISOString().slice(0, 10)) {
  const n = contarElementos(doc);
  if (!n) throw new Error('No hay nada con coordenadas para exportar.');
  descargar(`${nombreSeguro(base)}_${hoy}.${formato === 'kml' ? 'kml' : 'kmz'}`, archivoKmz(doc, formato), formato === 'kml' ? TIPO_KML : TIPO_KMZ);
  return n;
}
