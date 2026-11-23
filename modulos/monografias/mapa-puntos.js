// modulos/monografias/mapa-puntos.js — «Mapa de puntos» del proyecto (Monografías 0.5, Sistema v0.21).
// Ventana con el mapa satelital (Esri) y un símbolo por ficha, con el nombre acomodado para que no se tape.
// Encuadre «En pantalla» (zoom con + y −) o «Escala fija» (1:1.000 a 1:10.000 en A4/A3, con marco de la hoja).
// Descarga una imagen (PNG/JPG) o una hoja PDF con viñeta (datos comunes del paso 1 y cuadro de coordenadas),
// y el KMZ de los mismos puntos. La configuración queda guardada en el navegador (mn_mapa_prefs).

import { cargarScript, escapar as esc, descargar } from '../../compartido/util.js';
import { descargarDocumento } from '../../compartido/kmz.js';
import { carpetaMonografias } from '../../app/kmz-proyecto.js';
import { SIMBOLOS, FUENTES, capasDe, dibujarSimbolo, dibujarNorte } from './croquis.js';
import { logoEmpresa } from './pdf.js';
import {
  aMundo, metrosPorPixel, escalaPantalla, redondeoEscala, ESCALAS, diseñoHoja, areaMapaMm, zoomParaEscala, zoomConTope, escalaGrafica,
  acomodarNombres, anclaDeLinea, PPP_IMPRESION, ZOOM_MAX, TESELA,
} from './mapa-calculo.js';

const CLAVE = 'mn_mapa_prefs';
const COLORES = [['#E53935', 'Rojo'], ['#FDD835', 'Amarillo'], ['#FFFFFF', 'Blanco'], ['#00BCD4', 'Calipso']];
const PREFS_DEF = {
  simbolo: 'triangulo', color: '#E53935', tamSimbolo: 9, etiqueta: 'nombre', fuente: 'IBM Plex Sans', tamLetra: 14, negrita: true,
  colorLetra: '#FFFFFF', acomodar: true, fondo: 'imagen', norte: true, barra: true,
  modo: 'pantalla', escala: 5000, hoja: 'A4', orient: 'H', detalle: 0,
  formato: 'imagen', tipo: 'png', res: 3, titulo: 'Ubicación de puntos de referencia',
  vin: { logoEmpresa: true, logoCliente: true, proyecto: true, datum: true, resp: true, leyenda: true, cuadro: true },
};
const VINETA = [['logoEmpresa', 'Logo de la empresa'], ['logoCliente', 'Logo del cliente'], ['proyecto', 'Proyecto y mandante'], ['datum', 'Datum, huso y geoide'],
  ['resp', 'Fecha y responsables'], ['leyenda', 'Leyenda'], ['cuadro', 'Cuadro de coordenadas']];
const fmtN = n => Number(n).toLocaleString('es-CL');
const nombreSeguro = t => String(t || 'proyecto').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/_+/g, '_').slice(0, 60);
const hoyLegible = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`; };

function leerPrefs() {
  try { const g = JSON.parse(localStorage.getItem(CLAVE) || '{}'); return { ...PREFS_DEF, ...g, vin: { ...PREFS_DEF.vin, ...(g.vin || {}) } }; } catch { return { ...PREFS_DEF, vin: { ...PREFS_DEF.vin } }; }
}
function guardarPrefs(op) { try { localStorage.setItem(CLAVE, JSON.stringify(op)); } catch { /* sin almacenamiento */ } }

const contorno = hex => { const m = /^#?(\w\w)(\w\w)(\w\w)$/.exec(hex || ''); if (!m) return 'rgba(0,0,0,.8)'; const [r, g, b] = m.slice(1).map(x => parseInt(x, 16)); return (0.299 * r + 0.587 * g + 0.114 * b) > 140 ? 'rgba(0,0,0,.82)' : 'rgba(255,255,255,.92)'; };

/**
 * Símbolos, líneas guía y nombres sobre un canvas. pts: [{ x, y, nombre, cota }] en px del canvas.
 * f: factor de tamaño (1 en pantalla; 3 en la imagen «Alta»; 300/96 al imprimir). limites: { ancho, alto }.
 */
export function dibujarPuntos(c, pts0, op, f, limites, obstaculos = []) {
  const r = op.tamSimbolo * f;
  const pts = limites ? pts0.filter(p => p.x >= -r && p.y >= -r && p.x <= limites.ancho + r && p.y <= limites.alto + r) : pts0; // los de fuera no se dibujan
  const conNombre = op.etiqueta !== 'ninguna', conCota = op.etiqueta === 'nombre-cota';
  const fuente = `${op.negrita ? 'bold ' : ''}${op.tamLetra * f}px "${op.fuente}", Arial, sans-serif`;
  const fuenteCota = `${Math.round(op.tamLetra * 0.8 * f)}px "${op.fuente}", Arial, sans-serif`;
  const alto1 = op.tamLetra * 1.2 * f, alto2 = op.tamLetra * 0.8 * 1.25 * f, pad = 2 * f;
  const cajas = pts.map(p => {
    c.font = fuente; let w = c.measureText(p.nombre).width;
    const cota = conCota && p.cota ? `${p.cota} m` : '';
    if (cota) { c.font = fuenteCota; w = Math.max(w, c.measureText(cota).width); }
    return { x: p.x, y: p.y, w: w + 2 * pad, h: alto1 + (cota ? alto2 : 0) + pad, cota };
  });
  const lugares = conNombre
    ? (op.acomodar ? acomodarNombres(cajas, { r, limites, separacion: 4 * f, obstaculos }) : cajas.map(b => ({ x: b.x + r + 4 * f, y: b.y - r - 4 * f - b.h, linea: false })))
    : [];
  const borde = contorno(op.colorLetra);
  if (conNombre) {
    c.save(); c.lineCap = 'round';
    lugares.forEach((l, i) => {
      if (!l.linea) return;
      const b = { x: l.x, y: l.y, w: cajas[i].w, h: cajas[i].h }, [ax, ay] = anclaDeLinea(pts[i], b);
      c.strokeStyle = borde; c.lineWidth = 3.2 * f; c.beginPath(); c.moveTo(pts[i].x, pts[i].y); c.lineTo(ax, ay); c.stroke();
      c.strokeStyle = op.colorLetra; c.lineWidth = 1.4 * f; c.beginPath(); c.moveTo(pts[i].x, pts[i].y); c.lineTo(ax, ay); c.stroke();
    });
    c.restore();
  }
  for (const p of pts) dibujarSimbolo(c, op.simbolo, p.x, p.y, r, op.color);
  if (!conNombre) return;
  c.save(); c.textBaseline = 'top'; c.lineJoin = 'round';
  lugares.forEach((l, i) => {
    const x = l.x + pad, y = l.y + pad / 2;
    c.font = fuente; c.lineWidth = Math.max(2.5, op.tamLetra * f / 5.5); c.strokeStyle = borde; c.fillStyle = op.colorLetra;
    c.strokeText(pts[i].nombre, x, y); c.fillText(pts[i].nombre, x, y);
    if (cajas[i].cota) { c.font = fuenteCota; c.lineWidth = Math.max(2, op.tamLetra * f / 6.5); c.strokeText(cajas[i].cota, x, y + alto1); c.fillText(cajas[i].cota, x, y + alto1); }
  });
  c.restore();
}

function dibujarBarra(c, mpp, f, x, yBase) {
  const e = escalaGrafica(mpp, 150 * f);
  const h = 6 * f, padX = 8 * f;
  c.save();
  c.font = `${11 * f}px "IBM Plex Sans", Arial, sans-serif`;
  const caja = { x, y: yBase - 30 * f, w: e.px + 2 * padX + 24 * f, h: 30 * f };
  c.fillStyle = 'rgba(255,255,255,.88)'; c.fillRect(caja.x, caja.y, caja.w, caja.h);
  const bx = caja.x + padX, by = caja.y + 7 * f;
  for (let k = 0; k < 4; k++) { c.fillStyle = k % 2 ? '#FFFFFF' : '#1C1F23'; c.fillRect(bx + k * e.px / 4, by, e.px / 4, h); }
  c.strokeStyle = '#1C1F23'; c.lineWidth = f; c.strokeRect(bx, by, e.px, h);
  c.fillStyle = '#1C1F23'; c.textBaseline = 'top';
  c.fillText('0', bx - 2 * f, by + h + 3 * f);
  c.textAlign = 'right'; c.fillText(e.texto, bx + e.px + 22 * f, by + h + 3 * f);
  c.restore();
}

function dibujarAtribucion(c, op, f, ancho, alto) {
  const t = op.fondo === 'calles' ? 'Mapa © Esri, HERE, Garmin, OpenStreetMap' : 'Imagen © Esri, Maxar, Earthstar Geographics';
  c.save(); c.font = `${10 * f}px Arial, sans-serif`;
  const w = c.measureText(t).width + 10 * f, h = 15 * f;
  c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(ancho - w, alto - h, w, h);
  c.fillStyle = '#FFFFFF'; c.textBaseline = 'middle'; c.fillText(t, ancho - w + 5 * f, alto - h / 2);
  c.restore();
}

/** Zonas que los nombres no deben tapar: la flecha de norte (arriba a la derecha) y la escala gráfica (abajo a la izquierda). */
function zonasFijas(op, f, ancho, alto) {
  const z = [];
  if (op.norte) z.push({ x: ancho - 52 * f, y: 6 * f, w: 46 * f, h: 64 * f });
  if (op.barra) z.push({ x: 6 * f, y: alto - 48 * f, w: 210 * f, h: 42 * f });
  z.push({ x: ancho - 270 * f, y: alto - 18 * f, w: 270 * f, h: 18 * f }); // atribución
  return z;
}

const cargarImg = url => new Promise((ok, mal) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => ok(im); im.onerror = mal; im.src = url; });

/**
 * Dibuja el mapa a cualquier tamaño: teselas del zoom zt alrededor del centro, con mppSalida metros por píxel de salida.
 * pts: [{ lat, lon, nombre, cota }]. Devuelve { cv, fallidas, total }.
 */
async function renderizar({ centro, zt, mppSalida, ancho, alto, f, op, pts, alAvanzar }) {
  const cv = document.createElement('canvas');
  cv.width = Math.round(ancho); cv.height = Math.round(alto);
  const c = cv.getContext('2d');
  c.fillStyle = op.fondo === 'calles' ? '#F2EFE9' : '#7A6F52'; c.fillRect(0, 0, cv.width, cv.height);
  const [cx, cy] = aMundo(centro.lat, centro.lon, zt);
  const k = metrosPorPixel(centro.lat, zt) / mppSalida; // px de salida por px de tesela
  const wx0 = cx - ancho / 2 / k, wy0 = cy - alto / 2 / k;
  const n = 2 ** zt;
  const tx0 = Math.floor(wx0 / TESELA), tx1 = Math.floor((cx + ancho / 2 / k) / TESELA);
  const ty0 = Math.max(0, Math.floor(wy0 / TESELA)), ty1 = Math.min(n - 1, Math.floor((cy + alto / 2 / k) / TESELA));
  const lado = TESELA * k;
  let hechas = 0, fallidas = 0;
  const plantillas = capasDe(op);
  const total = (tx1 - tx0 + 1) * (ty1 - ty0 + 1) * plantillas.length;
  for (const plantilla of plantillas) {
    const cola = [];
    for (let tx = tx0; tx <= tx1; tx++) for (let ty = ty0; ty <= ty1; ty++) cola.push([tx, ty]);
    const trabajar = async () => {
      while (cola.length) {
        const [tx, ty] = cola.shift();
        const url = plantilla.replace('{z}', zt).replace('{x}', ((tx % n) + n) % n).replace('{y}', ty);
        try {
          const im = await cargarImg(url);
          const x = Math.floor((tx * TESELA - wx0) * k), y = Math.floor((ty * TESELA - wy0) * k);
          c.drawImage(im, x, y, Math.ceil(lado) + 1, Math.ceil(lado) + 1);
        } catch { fallidas++; }
        hechas++; alAvanzar && alAvanzar(hechas, total);
      }
    };
    await Promise.all(Array.from({ length: 8 }, trabajar));
  }
  const pxs = pts.map(p => { const [x, y] = aMundo(p.lat, p.lon, zt); return { ...p, x: (x - wx0) * k, y: (y - wy0) * k }; });
  dibujarPuntos(c, pxs, op, f, { ancho: cv.width, alto: cv.height }, zonasFijas(op, f, cv.width, cv.height));
  if (op.norte) dibujarNorte(c, cv.width - 30 * f, 14 * f, 34 * f);
  if (op.barra) dibujarBarra(c, mppSalida, f, 12 * f, cv.height - 12 * f);
  dibujarAtribucion(c, op, f, cv.width, cv.height);
  return { cv, fallidas, total };
}

async function dataUrlDe(url) {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  try { const im = await cargarImg(url); const cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight; cv.getContext('2d').drawImage(im, 0, 0); return cv.toDataURL('image/png'); } catch { return null; }
}

/** Hoja PDF con viñeta. mapa: { dataURL, escalaTexto, mppMm (metros por mm de papel) }. */
async function hojaPdf({ op, mapa, pts, datos, logos }) {
  if (!(window.jspdf && window.jspdf.jsPDF)) await cargarScript('vendor/jspdf.umd.min.js');
  const d = diseñoHoja(op.hoja, op.orient), [W, H] = d.papel;
  const doc = new window.jspdf.jsPDF({ orientation: W > H ? 'landscape' : 'portrait', unit: 'mm', format: op.hoja.toLowerCase() });
  const negro = () => { doc.setDrawColor(28, 31, 35); doc.setTextColor(28, 31, 35); };
  const gris = () => doc.setTextColor(91, 97, 104);
  negro(); doc.setLineWidth(0.4);
  doc.addImage(mapa.dataURL, 'JPEG', d.mapa.x, d.mapa.y, d.mapa.w, d.mapa.h, undefined, 'FAST');
  // Cuadro de coordenadas (lo que no cabe sigue en hojas aparte).
  const filas = op.vin.cuadro ? pts : [];
  const altoFila = 3.6, cab = 9;
  const grupos = r => Math.max(1, Math.floor(r.w / 95));
  const capacidad = r => grupos(r) * Math.max(1, Math.floor((r.h - cab - 2) / altoFila));
  const cap1 = capacidad(d.cuadro);
  const resto = filas.slice(cap1);
  const extra = { x: d.marco.x, y: d.marco.y, w: d.marco.w, h: d.marco.h };
  const paginas = 1 + (resto.length ? Math.ceil(resto.length / capacidad(extra)) : 0);
  const tabla = (r, lista, titulo) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); negro(); doc.text(titulo, r.x + 3, r.y + 5);
    const g = grupos(r), anchoG = (r.w - 6) / g, porG = Math.max(1, Math.floor((r.h - cab - 2) / altoFila));
    const cols = [0, 0.3, 0.57, 0.84]; // Punto · Este · Norte · Cota (las tres últimas a la derecha)
    for (let k = 0; k < g; k++) {
      const parte = lista.slice(k * porG, (k + 1) * porG);
      if (!parte.length && k) break;
      const x0 = r.x + 3 + k * anchoG, y0 = r.y + cab;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);
      doc.text('Punto', x0, y0); [['Este (m)', 1], ['Norte (m)', 2], ['Cota (m)', 3]].forEach(([t, j]) => doc.text(t, x0 + anchoG * (cols[j] + 0.25) - 2, y0, { align: 'right' }));
      doc.setLineWidth(0.2); doc.line(x0, y0 + 1, x0 + anchoG - 4, y0 + 1);
      doc.setFont('helvetica', 'normal');
      parte.forEach((p, i) => {
        const y = y0 + 1 + altoFila * (i + 1) - 0.8;
        doc.setFont('helvetica', 'bold'); doc.text(String(p.nombre).slice(0, 18), x0, y); doc.setFont('courier', 'normal');
        [[p.este, 1], [p.norte, 2], [p.cota, 3]].forEach(([v, j]) => doc.text(String(v || '—'), x0 + anchoG * (cols[j] + 0.25) - 2, y, { align: 'right' }));
      });
    }
  };
  if (op.vin.cuadro) tabla(d.cuadro, filas.slice(0, cap1), 'CUADRO DE COORDENADAS');
  // Viñeta: secciones de arriba abajo, más compactas si la hoja es vertical.
  const v = d.viñeta, esc2 = Math.min(1, (v.h - 6) / 120);
  let y = v.y;
  const linea = () => { doc.setLineWidth(0.3); doc.line(v.x, y, v.x + v.w, y); };
  const etiqueta = (t, x, yy) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5); gris(); doc.text(t.toUpperCase(), x, yy); };
  const valor = (t, x, yy, ancho, tam = 8) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(tam); negro(); const ls = doc.splitTextToSize(String(t || '—'), ancho); doc.text(ls.slice(0, 2), x, yy); };
  const imagenEnCaja = (url, x, yy, w, h) => {
    if (!url) { doc.setFont('helvetica', 'normal'); doc.setFontSize(6); gris(); doc.text('Sin logo', x + w / 2, yy + h / 2, { align: 'center' }); return; }
    try { const p = doc.getImageProperties(url), k = Math.min(w / p.width, h / p.height); doc.addImage(url, x + (w - p.width * k) / 2, yy + (h - p.height * k) / 2, p.width * k, p.height * k); } catch { /* imagen no válida */ }
  };
  if (op.vin.logoEmpresa || op.vin.logoCliente) {
    const h = 18 * esc2, ambos = op.vin.logoEmpresa && op.vin.logoCliente, w = ambos ? v.w / 2 : v.w;
    if (op.vin.logoEmpresa) imagenEnCaja(logos.empresa, v.x + 2, y + 2, w - 4, h - 4);
    if (op.vin.logoCliente) imagenEnCaja(logos.cliente, v.x + (ambos ? w : 0) + 2, y + 2, w - 4, h - 4);
    if (ambos) { doc.setLineWidth(0.3); doc.line(v.x + w, y, v.x + w, y + h); }
    y += h; linea();
  }
  const pad = 3, ancho = v.w - 2 * pad;
  etiqueta('Título', v.x + pad, y + 4); valor(op.titulo || 'Ubicación de puntos de referencia', v.x + pad, y + 8.5, ancho, 9.5); y += 15 * esc2 + 2; linea();
  if (op.vin.proyecto) {
    etiqueta('Proyecto', v.x + pad, y + 4); valor(datos.proyecto, v.x + pad, y + 7.5, ancho);
    etiqueta('Mandante', v.x + pad, y + 12.5 * Math.max(esc2, 0.85)); valor(datos.mandante, v.x + pad, y + 16 * Math.max(esc2, 0.85), ancho);
    y += 20 * Math.max(esc2, 0.85); linea();
  }
  if (op.vin.datum) {
    const mitad = (v.w - 2 * pad) / 2;
    etiqueta('Datum', v.x + pad, y + 4); valor(datos.datum, v.x + pad, y + 7.5, mitad - 2, 7);
    etiqueta('Proyección', v.x + pad + mitad, y + 4); valor(datos.huso ? `UTM huso ${datos.huso}` : '', v.x + pad + mitad, y + 7.5, mitad - 2, 7);
    etiqueta('Geoide', v.x + pad, y + 12); valor(datos.geoide, v.x + pad, y + 15.5, mitad - 2, 7);
    etiqueta('Medición', v.x + pad + mitad, y + 12); valor(datos.medicion, v.x + pad + mitad, y + 15.5, mitad - 2, 7);
    y += 19; linea();
  }
  if (op.vin.leyenda) {
    etiqueta('Leyenda', v.x + pad, y + 4);
    const [r, g, b] = [1, 3, 5].map(i => parseInt(op.color.slice(i, i + 2), 16));
    doc.setFillColor(r, g, b); doc.setDrawColor(28, 31, 35); doc.setLineWidth(0.15);
    const sx = v.x + pad + 2, sy = y + 8;
    if (op.simbolo === 'triangulo') doc.triangle(sx, sy - 1.8, sx + 1.8, sy + 1.4, sx - 1.8, sy + 1.4, 'FD');
    else if (op.simbolo === 'cuadrado') doc.rect(sx - 1.5, sy - 1.5, 3, 3, 'FD');
    else { doc.circle(sx, sy, 1.6, 'FD'); if (op.simbolo === 'circulo-cruz') { doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.3); doc.line(sx - 1, sy, sx + 1, sy); doc.line(sx, sy - 1, sx, sy + 1); } }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); negro(); doc.text('Punto de referencia', sx + 4, sy + 1);
    y += 12; linea();
  }
  // Escala y norte
  etiqueta(mapa.escalaTexto, v.x + pad, y + 4);
  const e = escalaGrafica(mapa.mppMm, Math.min(50, v.w - 26));
  const bx = v.x + pad, by = y + 6.5;
  for (let k = 0; k < 4; k++) { if (k % 2) doc.setFillColor(255, 255, 255); else doc.setFillColor(28, 31, 35); doc.rect(bx + k * e.px / 4, by, e.px / 4, 1.6, 'F'); }
  doc.setDrawColor(28, 31, 35); doc.setLineWidth(0.2); doc.rect(bx, by, e.px, 1.6);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6); negro(); doc.text('0', bx, by + 4.5); doc.text(e.texto, bx + e.px, by + 4.5, { align: 'right' });
  const nx = v.x + v.w - 9, ny = y + 3;
  doc.setFillColor(28, 31, 35); doc.triangle(nx, ny, nx + 2.6, ny + 6.5, nx - 2.6, ny + 6.5, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text('N', nx, ny + 10, { align: 'center' });
  y += 14; linea();
  if (op.vin.resp) {
    const mitad = (v.w - 2 * pad) / 2;
    etiqueta('Elaboró', v.x + pad, y + 4); valor(datos.elaboro, v.x + pad, y + 7.5, mitad - 2, 7);
    etiqueta('Revisó', v.x + pad + mitad, y + 4); valor(datos.reviso, v.x + pad + mitad, y + 7.5, mitad - 2, 7);
    etiqueta('Fecha', v.x + pad, y + 12); valor(hoyLegible(), v.x + pad, y + 15.5, mitad - 2, 7);
    etiqueta('Lámina', v.x + pad + mitad, y + 12); valor(`1 de ${paginas}`, v.x + pad + mitad, y + 15.5, mitad - 2, 7);
    y += 19; linea();
  }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5); gris();
  doc.text(op.fondo === 'calles' ? 'Mapa © Esri, HERE, Garmin, OpenStreetMap' : 'Imagen © Esri, Maxar, Earthstar Geographics', v.x + pad, v.y + v.h - 2);
  // Marcos
  negro(); doc.setLineWidth(0.5); doc.rect(d.marco.x, d.marco.y, d.marco.w, d.marco.h);
  doc.setLineWidth(0.4); doc.rect(d.mapa.x, d.mapa.y, d.mapa.w, d.mapa.h); doc.rect(d.viñeta.x, d.viñeta.y, d.viñeta.w, d.viñeta.h);
  if (op.vin.cuadro) doc.rect(d.cuadro.x, d.cuadro.y, d.cuadro.w, d.cuadro.h);
  // Continuación del cuadro
  let i = 0, pag = 1;
  while (i < resto.length) {
    doc.addPage(op.hoja.toLowerCase(), W > H ? 'landscape' : 'portrait'); pag++;
    const parte = resto.slice(i, i + capacidad(extra)); i += parte.length;
    negro(); doc.setLineWidth(0.5); doc.rect(extra.x, extra.y, extra.w, extra.h);
    tabla(extra, parte, `CUADRO DE COORDENADAS (CONTINUACIÓN) · LÁMINA ${pag} DE ${paginas}`);
  }
  return doc.output('blob');
}

/**
 * Abre la ventana. lista: puntos de puntosDeFichas (con estadoClave). comun: datos comunes normalizados.
 * proyecto: { nombre, mandante } · logoCliente: URL del logo del cliente o null.
 */
export async function abrirMapaPuntos({ proyecto, lista, comun, logoCliente = null }) {
  if (!window.L) await cargarScript('vendor/leaflet/leaflet.js');
  const L = window.L;
  const op = leerPrefs();
  const st = { filtro: 'todas' };
  const val = k => (comun && comun.valores && comun.valores[k]) || '';
  const conPos = () => lista.filter(p => p.lat != null && (st.filtro === 'todas' || p.estadoClave === 'lista'));
  const nListas = lista.filter(p => p.estadoClave === 'lista').length;

  const caja = document.createElement('div');
  caja.className = 'mn-modal mn-mp';
  caja.setAttribute('role', 'dialog'); caja.setAttribute('aria-modal', 'true'); caja.setAttribute('aria-label', 'Mapa de puntos');
  caja.innerHTML = `<div class="mn-modal-caja mn-mp-caja">
    <div class="mn-mp-cab"><div><h2>Mapa de puntos · ${esc(proyecto.nombre || '')}</h2><p class="sis-tenue" data-mp="resumen"></p></div>
      <div class="mn-mp-cab-acc"><span class="mn-mp-pildoras" data-mp="filtros"></span><button type="button" class="sis-btn chico" data-c="cerrar">Cerrar</button></div></div>
    <div class="mn-mp-cuerpo">
      <div class="mn-mp-izq">
        <div data-mp="barra"></div>
        <div class="mn-mp-mapa"><div class="mn-mp-leaflet"></div><canvas class="mn-mp-capa" aria-hidden="true"></canvas><div class="mn-mp-marco" hidden><span></span></div></div>
        <p class="sis-tenue mn-mp-ayuda" data-mp="ayuda"></p>
      </div>
      <div class="mn-mp-op" data-mp="op"></div>
    </div>
    <div class="mn-mp-pie"><span class="sis-tenue" data-mp="msg" role="status">Esta configuración queda guardada para el próximo mapa.</span>
      <div class="sis-acciones"><button type="button" class="sis-btn" data-c="kmz">Descargar KMZ</button><button type="button" class="sis-btn" data-c="cerrar">Cancelar</button><button type="button" class="sis-btn primario" data-c="descargar"></button></div></div>
  </div>`;
  document.body.appendChild(caja);
  const $ = s => caja.querySelector(s);
  const msg = t => { $('[data-mp="msg"]').textContent = t; };
  const lugar = $('.mn-mp-leaflet'), capa = $('.mn-mp-capa'), marco = $('.mn-mp-marco');

  const mapa = L.map(lugar, { zoomControl: false, attributionControl: true, zoomAnimation: false, maxZoom: ZOOM_MAX }).setView([-33.45, -70.66], 6);
  let fondo = null;
  const ponerFondo = () => { if (fondo) fondo.remove(); fondo = L.layerGroup(capasDe(op).map((u, i) => L.tileLayer(u, { maxZoom: ZOOM_MAX, crossOrigin: 'anonymous', attribution: i ? '' : (op.fondo === 'calles' ? 'Mapa © Esri, HERE, Garmin, OpenStreetMap' : 'Imagen © Esri, Maxar, Earthstar Geographics') }))).addTo(mapa); };
  ponerFondo();
  const ajustar = () => {
    const ps = conPos();
    if (!ps.length) return;
    if (ps.length === 1) mapa.setView([ps[0].lat, ps[0].lon], 16);
    else mapa.fitBounds(L.latLngBounds(ps.map(p => [p.lat, p.lon])), { padding: [60, 60], maxZoom: 18 });
  };

  // Tamaño en metros que cubre la hoja a la escala elegida (el marco punteado).
  const sueloHoja = () => { const [w, h] = areaMapaMm(op.formato, op.hoja, op.orient); return [w / 1000 * op.escala, h / 1000 * op.escala]; };
  const rectMarco = () => {
    const t = mapa.getSize(), c = mapa.getCenter(), mpp = metrosPorPixel(c.lat, mapa.getZoom()), [gw, gh] = sueloHoja();
    const w = gw / mpp, h = gh / mpp;
    return { x: (t.x - w) / 2, y: (t.y - h) / 2, w, h };
  };
  const fuera = () => {
    if (op.modo !== 'escala') return [];
    const r = rectMarco();
    return conPos().filter(p => { const q = mapa.latLngToContainerPoint([p.lat, p.lon]); return q.x < r.x || q.x > r.x + r.w || q.y < r.y || q.y > r.y + r.h; });
  };

  function pintarCapa() {
    const t = mapa.getSize(), dpr = window.devicePixelRatio || 1;
    capa.width = t.x * dpr; capa.height = t.y * dpr; capa.style.width = `${t.x}px`; capa.style.height = `${t.y}px`;
    const c = capa.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, t.x, t.y);
    const pts = conPos().map(p => { const q = mapa.latLngToContainerPoint([p.lat, p.lon]); return { ...p, x: q.x, y: q.y }; });
    dibujarPuntos(c, pts, op, 1, { ancho: t.x, alto: t.y }, zonasFijas({ ...op, barra: op.barra && op.modo === 'pantalla' }, 1, t.x, t.y));
    if (op.norte) dibujarNorte(c, t.x - 30, 14, 34);
    if (op.barra && op.modo === 'pantalla') dibujarBarra(c, metrosPorPixel(mapa.getCenter().lat, mapa.getZoom()), 1, 12, t.y - 24);
    if (op.modo === 'escala') {
      const r = rectMarco();
      marco.hidden = false;
      Object.assign(marco.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
      marco.querySelector('span').textContent = `Hoja ${op.hoja} ${op.orient === 'H' ? 'horizontal' : 'vertical'} · 1:${fmtN(op.escala)}`;
    } else marco.hidden = true;
  }

  const pildora = (k, v, t, mono = false) => `<button type="button" class="vu-pildora${op[k] === v ? ' activo' : ''}${mono ? ' mn-mp-mono' : ''}" data-c="set" data-k="${k}" data-v="${esc(String(v))}" aria-pressed="${op[k] === v}">${esc(t)}</button>`;
  const segmento = (k, ops) => `<span class="sis-vistas mn-mp-seg" role="group">${ops.map(([v, t]) => `<button type="button" class="${op[k] === v ? 'activo' : ''}" data-c="set" data-k="${k}" data-v="${esc(String(v))}" aria-pressed="${op[k] === v}">${esc(t)}</button>`).join('')}</span>`;

  function pintarBarra() {
    const z = mapa.getZoom(), lat = mapa.getCenter().lat;
    const zAuto = zoomParaEscala(op.escala, lat, 0);
    const fu = fuera();
    $('[data-mp="barra"]').innerHTML = `<div class="mn-mp-fila"><span class="mn-mp-rotulo">Encuadre</span>${segmento('modo', [['pantalla', 'En pantalla'], ['escala', 'Escala fija']])}</div>
      ${op.modo === 'pantalla' ? `<div class="mn-mp-herr">
          <span class="mn-mp-zoom"><button type="button" class="sis-btn chico" data-c="zoom" data-v="-1" aria-label="Alejar">−</button>
          <span><b class="mono">Zoom ${z}</b> <span class="sis-tenue">· ≈ 1:${fmtN(escalaPantalla(lat, z))}</span></span>
          <button type="button" class="sis-btn chico" data-c="zoom" data-v="1" aria-label="Acercar" ${z >= ZOOM_MAX ? 'disabled' : ''}>+</button></span>
          <button type="button" class="sis-btn chico" data-c="ajustar">Ajustar a todos los puntos</button></div>`
      : `<div class="mn-mp-herr mn-mp-esc">
          <div><span class="mn-mp-rotulo">Escala</span><span class="mn-mp-pildoras">${ESCALAS.map(e => pildora('escala', e, `1:${fmtN(e)}`, true)).join('')}</span></div>
          <div><span class="mn-mp-rotulo">Hoja</span><span class="mn-mp-pildoras">${pildora('hoja', 'A4', 'A4')}${pildora('hoja', 'A3', 'A3')}${pildora('orient', 'H', 'Horizontal')}${pildora('orient', 'V', 'Vertical')}</span></div>
          <div><span class="mn-mp-rotulo">Detalle de la imagen satelital</span><span class="mn-mp-pildoras">${pildora('detalle', 0, `Automático (zoom ${zAuto})`)}${zAuto < ZOOM_MAX ? pildora('detalle', 1, `Más (${zAuto + 1})`) : ''}${zAuto + 1 < ZOOM_MAX ? pildora('detalle', 2, `Máximo (${ZOOM_MAX})`) : ''}</span></div>
          <div class="mn-mp-aviso ${fu.length ? 'mal' : 'bien'}">${fu.length ? `${fu.length} punto${fu.length === 1 ? '' : 's'} fuera de la hoja (${esc(fu.slice(0, 4).map(p => p.nombre).join(', '))}${fu.length > 4 ? '…' : ''}). Mueve el mapa o prueba otra escala u hoja más grande.` : 'Todos los puntos caben en la hoja.'}
            <button type="button" class="sis-btn chico" data-c="ver-hoja">Ver la hoja completa</button></div></div>`}`;
    $('[data-mp="ayuda"]').textContent = op.modo === 'pantalla'
      ? 'Arrastra el mapa para moverlo y usa + / − para el zoom: lo que ves es lo que se descarga.'
      : 'El marco punteado es lo que cabe en la hoja a esa escala. Arrastra el mapa para centrarla.';
  }

  function salida() {
    const lat = mapa.getCenter().lat, z = mapa.getZoom(), t = mapa.getSize();
    if (op.formato === 'imagen') {
      if (op.modo === 'pantalla') return [`${op.tipo.toUpperCase()} · ${fmtN(t.x * op.res)} × ${fmtN(t.y * op.res)} px`, `Zoom ${z} de la imagen satelital · escala aproximada 1:${fmtN(escalaPantalla(lat, z))}.`];
      const mm = areaMapaMm('imagen', op.hoja, op.orient), px = mm.map(v => Math.round(v / 25.4 * PPP_IMPRESION));
      const [gw, gh] = sueloHoja();
      const zi = zoomConTope(gw, gh, lat, zoomParaEscala(op.escala, lat, op.detalle));
      return [`${op.tipo.toUpperCase()} · ${fmtN(px[0])} × ${fmtN(px[1])} px a 300 ppp`, `Impresa en ${op.hoja} ${op.orient === 'H' ? 'horizontal' : 'vertical'} (márgenes de 10 mm) queda exacta a 1:${fmtN(op.escala)} · zoom ${zi} de la imagen.`];
    }
    if (op.modo === 'escala') {
      const [gw, gh] = sueloHoja();
      return [`PDF · hoja ${op.hoja} ${op.orient === 'H' ? 'horizontal' : 'vertical'} con viñeta`, `Escala 1:${fmtN(op.escala)} con escala gráfica · zoom ${zoomConTope(gw, gh, lat, zoomParaEscala(op.escala, lat, op.detalle))} de la imagen.`];
    }
    return [`PDF · hoja ${op.hoja} ${op.orient === 'H' ? 'horizontal' : 'vertical'} con viñeta`, 'Escala aproximada, según lo que se ve; para escala exacta usa «Escala fija».'];
  }

  function pintarOp() {
    const [s1, s2] = salida();
    $('[data-mp="op"]').innerHTML = `
      <section><h3>Símbolo del punto</h3>
        <div class="mn-mp-simbolos">${SIMBOLOS.filter(([k]) => k !== 'estrella').map(([k, t]) => `<button type="button" class="mn-mp-simbolo${op.simbolo === k ? ' activo' : ''}" data-c="set" data-k="simbolo" data-v="${k}" aria-pressed="${op.simbolo === k}"><canvas width="24" height="24" data-sim="${k}" aria-hidden="true"></canvas>${esc(t)}</button>`).join('')}</div>
        <div class="mn-mp-fila"><span class="mn-mp-rotulo">Color</span><span class="mn-mp-colores">${COLORES.map(([h, n]) => `<button type="button" class="mn-mp-color${op.color.toUpperCase() === h ? ' activo' : ''}" style="background:${h}" data-c="set" data-k="color" data-v="${h}" aria-label="${n}" aria-pressed="${op.color.toUpperCase() === h}"></button>`).join('')}<input type="color" value="${esc(op.color)}" data-o="color" aria-label="Otro color"></span>
          <label class="mn-mp-num">Tamaño <input type="number" min="4" max="30" value="${op.tamSimbolo}" data-o="tamSimbolo"></label></div></section>
      <section><h3>Nombre en el mapa</h3>
        <div class="mn-mp-pildoras">${pildora('etiqueta', 'nombre', 'Nombre')}${pildora('etiqueta', 'nombre-cota', 'Nombre y cota')}${pildora('etiqueta', 'ninguna', 'Sin nombre')}</div>
        <div class="sis-par"><label class="sis-campo"><span>Tipo de letra</span><select data-o="fuente">${FUENTES.map(([k, t]) => `<option value="${esc(k)}" ${op.fuente === k ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
          <label class="sis-campo"><span>Alto de letra (px)</span><input type="number" min="8" max="40" value="${op.tamLetra}" data-o="tamLetra"></label></div>
        <label class="sis-campo mn-mp-color-letra"><span>Color de letra</span><input type="color" value="${esc(op.colorLetra)}" data-o="colorLetra"></label>
        <label class="sis-check"><input type="checkbox" data-o="acomodar" ${op.acomodar ? 'checked' : ''}> <span>Acomodar los nombres para que no se tapen<small class="sis-tenue">Si un nombre choca con otro, se corre y queda unido a su punto con una línea.</small></span></label>
        <label class="sis-check"><input type="checkbox" data-o="negrita" ${op.negrita ? 'checked' : ''}> Negrita</label></section>
      <section><h3>Fondo y elementos</h3>
        <div class="mn-mp-pildoras">${pildora('fondo', 'imagen', 'Imagen satelital')}${pildora('fondo', 'hibrido', 'Híbrido')}${pildora('fondo', 'calles', 'Calles')}</div>
        <label class="sis-check"><input type="checkbox" data-o="norte" ${op.norte ? 'checked' : ''}> Flecha de norte</label>
        <label class="sis-check"><input type="checkbox" data-o="barra" ${op.barra ? 'checked' : ''}> Escala gráfica</label>
        <p class="sis-tenue">La atribución de la imagen va siempre en la esquina inferior derecha.</p></section>
      <section><h3>Descarga</h3>
        ${segmento('formato', [['imagen', 'Imagen'], ['hoja', 'Hoja con viñeta (PDF)']])}
        ${op.formato === 'imagen' ? `<div class="mn-mp-fila"><span class="mn-mp-rotulo">Formato</span><span class="mn-mp-pildoras">${pildora('tipo', 'png', 'PNG')}${pildora('tipo', 'jpg', 'JPG')}</span></div>
          ${op.modo === 'pantalla' ? `<div class="mn-mp-fila"><span class="mn-mp-rotulo">Resolución</span><span class="mn-mp-pildoras">${pildora('res', 2, 'Normal (2×)')}${pildora('res', 3, 'Alta (3×)')}</span></div>` : ''}`
        : `${op.modo === 'pantalla' ? `<div class="mn-mp-fila"><span class="mn-mp-rotulo">Hoja</span><span class="mn-mp-pildoras">${pildora('hoja', 'A4', 'A4')}${pildora('hoja', 'A3', 'A3')}${pildora('orient', 'H', 'Horizontal')}${pildora('orient', 'V', 'Vertical')}</span></div>` : ''}
          <label class="sis-campo"><span>Título del plano</span><input value="${esc(op.titulo)}" data-o="titulo" maxlength="80"></label>
          <span class="mn-mp-rotulo">La viñeta incluye</span>
          <div class="mn-mp-vin">${VINETA.map(([k, t]) => `<label class="sis-check"><input type="checkbox" data-vin="${k}" ${op.vin[k] ? 'checked' : ''}> ${esc(t)}</label>`).join('')}</div>
          <p class="sis-tenue">Los datos salen de «Datos comunes» del paso 1; no se escriben de nuevo.</p>`}
        <div class="mn-mp-salida"><b>${esc(s1)}</b><span class="sis-tenue">${esc(s2)}</span></div></section>`;
    caja.querySelectorAll('canvas[data-sim]').forEach(cv => { const c = cv.getContext('2d'); c.clearRect(0, 0, 24, 24); dibujarSimbolo(c, cv.dataset.sim, 12, 12, 8, op.color); });
    $('[data-c="descargar"]').textContent = op.formato === 'imagen' ? `Descargar imagen ${op.tipo.toUpperCase()}` : 'Descargar hoja PDF';
  }

  function pintarCab() {
    const ps = conPos(), base = st.filtro === 'todas' ? lista : lista.filter(p => p.estadoClave === 'lista');
    const sin = base.filter(p => p.lat == null);
    $('[data-mp="resumen"]').textContent = !base.length ? 'No hay fichas con ese filtro.'
      : `${ps.length} de ${base.length} ficha${base.length === 1 ? '' : 's'} en el mapa${sin.length ? ` · ${sin.slice(0, 4).map(p => p.nombre).join(', ')}${sin.length > 4 ? '…' : ''} ${sin.length === 1 ? 'aún no tiene' : 'aún no tienen'} coordenadas` : ''}.`;
    $('[data-mp="filtros"]').innerHTML = `<button type="button" class="vu-pildora${st.filtro === 'todas' ? ' activo' : ''}" data-c="filtro" data-v="todas">Todas · ${lista.length}</button><button type="button" class="vu-pildora${st.filtro === 'listas' ? ' activo' : ''}" data-c="filtro" data-v="listas" ${nListas ? '' : 'disabled'}>Solo listas · ${nListas}</button>`;
  }

  const pintarTodo = () => { pintarCab(); pintarBarra(); pintarOp(); pintarCapa(); };
  mapa.on('move zoom resize', () => { pintarCapa(); });
  mapa.on('moveend zoomend', () => { pintarBarra(); if (op.formato === 'imagen' || op.modo === 'pantalla') pintarOp(); });
  // El mapa cambia de alto con la barra de herramientas (en pantalla / escala fija) y al girar el teléfono.
  const vigia = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { mapa.invalidateSize(); pintarCapa(); }) : null;
  if (vigia) vigia.observe(lugar);
  setTimeout(() => { mapa.invalidateSize(); ajustar(); pintarTodo(); }, 0);
  pintarTodo();

  // ─────────── Descarga ───────────
  async function armarMapa({ paraHoja }) {
    const c = mapa.getCenter(), lat = c.lat, z = mapa.getZoom(), t = mapa.getSize();
    const opDib = paraHoja ? { ...op, norte: false, barra: false } : op;
    const pts = conPos();
    const avance = (h, n) => msg(`Imagen satelital: ${h} de ${n} teselas…`);
    if (op.modo === 'pantalla' && !paraHoja) {
      const zt = Math.min(ZOOM_MAX, z + (op.res > 1 ? 1 : 0));
      const mppSalida = metrosPorPixel(lat, z) / op.res;
      return { ...(await renderizar({ centro: { lat, lon: c.lng }, zt, mppSalida, ancho: t.x * op.res, alto: t.y * op.res, f: op.res, op: opDib, pts, alAvanzar: avance })), mppSalida, escala: escalaPantalla(lat, z) };
    }
    const f = PPP_IMPRESION / 96;
    const mm = areaMapaMm(paraHoja ? 'hoja' : 'imagen', op.hoja, op.orient), px = mm.map(v => Math.round(v / 25.4 * PPP_IMPRESION));
    let mppSalida, escala, aprox = false;
    if (op.modo === 'escala') { escala = op.escala; mppSalida = escala * 0.0254 / PPP_IMPRESION; }
    else { mppSalida = t.x * metrosPorPixel(lat, z) / px[0]; escala = redondeoEscala(mppSalida * PPP_IMPRESION / 0.0254); aprox = true; }
    const [gw, gh] = [px[0] * mppSalida, px[1] * mppSalida];
    const zt = zoomConTope(gw, gh, lat, op.modo === 'escala' ? zoomParaEscala(escala, lat, op.detalle) : Math.min(ZOOM_MAX, z + 1));
    const r = await renderizar({ centro: { lat, lon: c.lng }, zt, mppSalida, ancho: px[0], alto: px[1], f, op: opDib, pts, alAvanzar: avance });
    return { ...r, mppSalida, escala, aprox };
  }

  async function descargarMapa(boton) {
    if (!conPos().length) { msg('No hay fichas con coordenadas para dibujar.'); return; }
    boton.disabled = true;
    const base = `Mapa_puntos_${nombreSeguro(proyecto.nombre)}_${new Date().toISOString().slice(0, 10)}`;
    try {
      if (op.formato === 'imagen') {
        const r = await armarMapa({ paraHoja: false });
        const tipo = op.tipo === 'jpg' ? 'image/jpeg' : 'image/png';
        const blob = await new Promise(ok => r.cv.toBlob(ok, tipo, 0.92));
        if (!blob) throw new Error('El navegador no pudo armar la imagen (muy grande). Prueba una resolución menor u hoja A4.');
        descargar(`${base}.${op.tipo === 'jpg' ? 'jpg' : 'png'}`, blob, tipo);
        msg(r.fallidas ? `Imagen descargada, pero ${r.fallidas} de ${r.total} teselas no cargaron (sin conexión o el servidor no respondió).` : `Imagen descargada: ${fmtN(r.cv.width)} × ${fmtN(r.cv.height)} px.`);
      } else {
        const r = await armarMapa({ paraHoja: true });
        msg('Armando la hoja PDF…');
        const datos = {
          proyecto: val('nombreProyecto') || proyecto.nombre, mandante: val('clienteNombre') || proyecto.mandante || '',
          datum: val('datumUTM'), huso: val('zonaUTM'), geoide: val('geoide'), medicion: val('tipoMedicion'),
          elaboro: val('operadorNombre'), reviso: val('revisoNombre'),
        };
        const logos = { empresa: op.vin.logoEmpresa ? await dataUrlDe(logoEmpresa()) : null, cliente: op.vin.logoCliente ? await dataUrlDe(logoCliente) : null };
        const blob = await hojaPdf({ op, pts: lista.filter(p => st.filtro === 'todas' || p.estadoClave === 'lista'), datos, logos,
          mapa: { dataURL: r.cv.toDataURL('image/jpeg', 0.9), escalaTexto: `${r.aprox ? 'Escala aprox.' : 'Escala'} 1:${fmtN(r.escala)}`, mppMm: r.mppSalida * PPP_IMPRESION / 25.4 } });
        descargar(`${base}.pdf`, blob, 'application/pdf');
        msg(r.fallidas ? `Hoja descargada, pero ${r.fallidas} de ${r.total} teselas no cargaron.` : 'Hoja PDF descargada.');
      }
      guardarPrefs(op);
    } catch (e) { console.warn(e); msg(e.message || 'No se pudo armar el mapa.'); }
    boton.disabled = false;
  }

  return new Promise(resolver => {
    const cerrar = () => { guardarPrefs(op); if (vigia) vigia.disconnect(); mapa.remove(); caja.remove(); document.removeEventListener('keydown', tecla); resolver(); };
    const tecla = ev => { if (ev.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', tecla);
    const cambiar = (k, v) => {
      op[k] = v;
      if (k === 'fondo') ponerFondo();
      if (k === 'formato' && v === 'hoja' && op.modo === 'pantalla') { /* la hoja usa A4/A3 y orientación también en pantalla */ }
      pintarBarra(); pintarOp(); pintarCapa(); guardarPrefs(op);
    };
    caja.addEventListener('click', ev => {
      const b = ev.target.closest('[data-c]'); if (!b || b.disabled) return;
      const a = b.dataset.c;
      if (a === 'cerrar') cerrar();
      else if (a === 'set') { const v0 = b.dataset.v, v = ['escala', 'res', 'detalle'].includes(b.dataset.k) ? Number(v0) : v0; cambiar(b.dataset.k, v); }
      else if (a === 'zoom') mapa.setZoom(Math.max(1, Math.min(ZOOM_MAX, mapa.getZoom() + Number(b.dataset.v))));
      else if (a === 'ajustar') ajustar();
      else if (a === 'ver-hoja') {
        const t = mapa.getSize(), [gw, gh] = sueloHoja(), lat = mapa.getCenter().lat;
        let z = ZOOM_MAX; while (z > 1 && (gw / metrosPorPixel(lat, z) > t.x * 0.92 || gh / metrosPorPixel(lat, z) > t.y * 0.92)) z--;
        mapa.setZoom(z);
      }
      else if (a === 'filtro') { st.filtro = b.dataset.v; pintarTodo(); }
      else if (a === 'descargar') descargarMapa(b);
      else if (a === 'kmz') {
        try { const n = descargarDocumento({ nombre: `${proyecto.nombre || 'Proyecto'} · Monografías`, carpetas: [carpetaMonografias(conPos())] }, `Monografias_${proyecto.nombre || 'proyecto'}`); msg(`KMZ descargado: ${n} punto${n === 1 ? '' : 's'}.`); } catch (e) { msg(e.message); }
      }
    });
    const leer = ev => {
      const t = ev.target;
      if (t.dataset.vin) { op.vin[t.dataset.vin] = t.checked; guardarPrefs(op); return; }
      const k = t.dataset.o; if (!k) return;
      const v = t.type === 'checkbox' ? t.checked : t.type === 'number' ? Math.max(Number(t.min) || 1, Math.min(Number(t.max) || 99, Number(t.value) || 0)) : t.value;
      op[k] = v;
      if (k === 'titulo') { guardarPrefs(op); return; }
      if (k === 'color') caja.querySelectorAll('canvas[data-sim]').forEach(cv => { const c = cv.getContext('2d'); c.clearRect(0, 0, 24, 24); dibujarSimbolo(c, cv.dataset.sim, 12, 12, 8, op.color); });
      pintarCapa(); guardarPrefs(op);
    };
    caja.addEventListener('input', leer);
    caja.addEventListener('change', ev => { leer(ev); if (ev.target.dataset.o === 'color') pintarOp(); });
  });
}

