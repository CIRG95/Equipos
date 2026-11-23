// modulos/monografias/mapa-calculo.js — cálculos del «Mapa de puntos» del proyecto (Monografías 0.5, Sistema v0.21).
// Sin pantalla: posición de cada ficha, proyección Web Mercator de las teselas, escala, tamaño de la hoja,
// zoom para una escala fija y nombres acomodados para que no se tapen. Se prueba en node.

import { numero, utmAGeo } from './comun.js';
import { leerGrados } from './coordenadas.js';

export const TESELA = 256;
export const ZOOM_MAX = 19;
const R_TIERRA = 6378137;

/** Posición de una ficha: sus geográficas o, si faltan, las calculadas desde UTM. → { lat, lon } o null. */
export function posicionDe(f) {
  let lat = leerGrados(f.latitud), lon = leerGrados(f.longitud);
  if ((lat == null || lon == null) && numero(f.este) != null && numero(f.norte) != null) {
    const g = utmAGeo(numero(f.este), numero(f.norte), f.zonaUTM);
    if (g) ({ lat, lon } = g);
  }
  if (lat == null || lon == null || !isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 85 || Math.abs(lon) > 180 || (!lat && !lon)) return null;
  return { lat, lon };
}

/** Lon/lat → píxel del mundo en el zoom z (teselas de 256 px). */
export function aMundo(lat, lon, z) {
  const n = TESELA * 2 ** z, s = Math.sin(lat * Math.PI / 180);
  return [(lon + 180) / 360 * n, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n];
}
/** Píxel del mundo → { lat, lon }. */
export function deMundo(x, y, z) {
  const n = TESELA * 2 ** z;
  const lon = x / n * 360 - 180;
  const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;
  return { lat, lon };
}

/** Metros que mide un píxel de tesela en el zoom z, a esa latitud. */
export function metrosPorPixel(lat, z) {
  return 2 * Math.PI * R_TIERRA * Math.cos(lat * Math.PI / 180) / (TESELA * 2 ** z);
}

/** Escala aproximada de lo que se ve en pantalla (96 ppp), con dos cifras significativas (≈ 1:7.600). */
export function escalaPantalla(lat, z, ppp = 96) {
  const n = metrosPorPixel(lat, z) / (0.0254 / ppp);
  return redondeoEscala(n);
}
export function redondeoEscala(n) {
  if (!(n > 0)) return 0;
  const p = 10 ** (Math.floor(Math.log10(n)) - 1);
  return Math.round(n / p) * p;
}

export const ESCALAS = [1000, 2000, 5000, 10000];
export const HOJAS = { A4: [297, 210], A3: [420, 297] };
export const MARGEN_MM = 10;
export const PPP_IMPRESION = 300;

/** Tamaño del papel en mm según hoja y orientación ('H' | 'V'). */
export function papel(hoja = 'A4', orient = 'H') {
  const [a, b] = HOJAS[hoja] || HOJAS.A4;
  return orient === 'V' ? [b, a] : [a, b];
}

/**
 * Rectángulos (mm) de la hoja con viñeta: mapa, cuadro de coordenadas y viñeta.
 * Horizontal: el mapa y el cuadro a la izquierda, la viñeta en una columna a la derecha.
 * Vertical: el mapa arriba, el cuadro y la viñeta abajo, lado a lado.
 */
export function diseñoHoja(hoja = 'A4', orient = 'H') {
  const [W, H] = papel(hoja, orient), m = MARGEN_MM;
  const ancho = W - 2 * m, alto = H - 2 * m;
  if (orient === 'V') {
    const altoAbajo = Math.round(alto * 0.3);
    const mapa = { x: m, y: m, w: ancho, h: alto - altoAbajo };
    const anchoViñeta = Math.round(ancho * 0.45);
    return { papel: [W, H], marco: { x: m, y: m, w: ancho, h: alto }, mapa,
      cuadro: { x: m, y: m + mapa.h, w: ancho - anchoViñeta, h: altoAbajo },
      viñeta: { x: m + ancho - anchoViñeta, y: m + mapa.h, w: anchoViñeta, h: altoAbajo } };
  }
  const anchoViñeta = Math.round(Math.min(80, ancho * 0.28));
  const altoCuadro = Math.round(alto * 0.27);
  const izq = ancho - anchoViñeta;
  return { papel: [W, H], marco: { x: m, y: m, w: ancho, h: alto },
    mapa: { x: m, y: m, w: izq, h: alto - altoCuadro },
    cuadro: { x: m, y: m + alto - altoCuadro, w: izq, h: altoCuadro },
    viñeta: { x: m + izq, y: m, w: anchoViñeta, h: alto } };
}

/** Área del mapa en mm: la hoja entera menos los márgenes (imagen) o el recuadro del mapa (hoja con viñeta). */
export function areaMapaMm(formato, hoja, orient) {
  if (formato === 'hoja') { const d = diseñoHoja(hoja, orient); return [d.mapa.w, d.mapa.h]; }
  const [W, H] = papel(hoja, orient);
  return [W - 2 * MARGEN_MM, H - 2 * MARGEN_MM];
}

/**
 * Zoom de teselas para una escala: el primero cuya imagen satelital tiene al menos el detalle de 200 ppp impresos
 * (más que eso la imagen de Esri no gana nitidez y se piden muchas más teselas). detalle suma niveles (máx. 19).
 */
export const PPP_DETALLE = 200;
export function zoomParaEscala(escala, lat, detalle = 0, ppp = PPP_DETALLE) {
  const mSalida = escala * 0.0254 / ppp; // metros que cubre un píxel impreso
  let z = 0;
  while (z < ZOOM_MAX && metrosPorPixel(lat, z) > mSalida) z++;
  return Math.min(ZOOM_MAX, z + Math.max(0, detalle | 0));
}

/** Cantidad de teselas para cubrir un área de anchoM × altoM metros en el zoom z. */
export function teselasPara(anchoM, altoM, lat, z) {
  const mpp = metrosPorPixel(lat, z);
  return (Math.ceil(anchoM / mpp / TESELA) + 1) * (Math.ceil(altoM / mpp / TESELA) + 1);
}
/** Baja el zoom hasta que las teselas no pasen del máximo (para no pedir miles de imágenes). */
export function zoomConTope(anchoM, altoM, lat, z, maxTeselas = 600) {
  while (z > 1 && teselasPara(anchoM, altoM, lat, z) > maxTeselas) z--;
  return z;
}

/** Escala gráfica: largo redondo (1, 2 o 5 × 10ⁿ m) que cabe en maxPx. → { metros, px, texto }. */
export function escalaGrafica(mpp, maxPx = 160) {
  const maxM = mpp * maxPx;
  const p = 10 ** Math.floor(Math.log10(maxM));
  const metros = [5, 2, 1].map(k => k * p).find(x => x <= maxM) || p;
  return { metros, px: metros / mpp, texto: metros >= 1000 ? `${(metros / 1000).toLocaleString('es-CL')} km` : `${metros.toLocaleString('es-CL')} m` };
}

// ─────────── Nombres que no se tapan ───────────
const choca = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * Ubica el nombre de cada punto donde no choque con otro nombre ni con los símbolos.
 * puntos: [{ x, y, w, h }] (centro del símbolo y tamaño del nombre en px) · r: radio del símbolo.
 * limites: { ancho, alto } del mapa · obstaculos: [{ x, y, w, h }] que tampoco se pueden tapar (norte, escala gráfica). Prueba 8 posiciones junto al punto y, si todas chocan, anillos más lejanos
 * unidos con una línea guía. Devuelve [{ x, y, linea }] con la esquina superior izquierda del nombre.
 */
export function acomodarNombres(puntos, { r = 8, limites = null, separacion = 4, obstaculos = [] } = {}) {
  const ocupados = [...puntos.map(p => ({ x: p.x - r, y: p.y - r, w: 2 * r, h: 2 * r })), ...obstaculos];
  const dentro = c => !limites || (c.x >= 0 && c.y >= 0 && c.x + c.w <= limites.ancho && c.y + c.h <= limites.alto);
  // Orden: primero los puntos con más vecinos cerca (son los difíciles).
  const vecinos = puntos.map((p, i) => puntos.reduce((s, q, j) => s + (i !== j && Math.hypot(p.x - q.x, p.y - q.y) < 4 * (p.w + p.h) ? 1 : 0), 0));
  const orden = puntos.map((_, i) => i).sort((a, b) => vecinos[b] - vecinos[a] || a - b);
  const salida = new Array(puntos.length);
  for (const i of orden) {
    const p = puntos[i], d = r + separacion;
    const cerca = [
      [d, -d - p.h], [d, -p.h / 2], [-d - p.w, -d - p.h], [-d - p.w, -p.h / 2],
      [d, d], [-d - p.w, d], [-p.w / 2, -d - p.h], [-p.w / 2, d],
    ];
    let elegido = null;
    for (const [dx, dy] of cerca) {
      const c = { x: p.x + dx, y: p.y + dy, w: p.w, h: p.h };
      if (dentro(c) && !ocupados.some(o => choca(c, o))) { elegido = { ...c, linea: false }; break; }
    }
    for (let anillo = 1; !elegido && anillo <= 6; anillo++) {
      const dist = d + anillo * (p.h + 6);
      for (let k = 0; k < 16 && !elegido; k++) {
        const ang = -Math.PI / 4 + k * Math.PI / 8;
        const cx = p.x + Math.cos(ang) * dist, cy = p.y + Math.sin(ang) * dist;
        const c = { x: Math.cos(ang) >= 0 ? cx : cx - p.w, y: cy - p.h / 2, w: p.w, h: p.h };
        if (dentro(c) && !ocupados.some(o => choca(c, o))) elegido = { ...c, linea: true };
      }
    }
    if (!elegido) elegido = { x: p.x + d, y: p.y - d - p.h, w: p.w, h: p.h, linea: false }; // no hay lugar: queda en su posición normal
    ocupados.push(elegido);
    salida[i] = elegido;
  }
  return salida.map(c => ({ x: c.x, y: c.y, linea: c.linea }));
}

/** Punto de la caja del nombre más cercano al símbolo (donde termina la línea guía). */
export function anclaDeLinea(p, caja) {
  return [Math.max(caja.x, Math.min(p.x, caja.x + caja.w)), Math.max(caja.y, Math.min(p.y, caja.y + caja.h))];
}

/**
 * Puntos del mapa desde la lista del proyecto ([{ id, ficha, estado }]), en orden natural (PR-2 antes que PR-10).
 * → [{ id, nombre, lat, lon, este, norte, cota, estado, estadoClave }] · lat/lon null si la ficha no tiene coordenadas.
 */
export function puntosDeFichas(lista, textoEstado = e => e) {
  return lista.map(x => {
    const f = x.ficha || {}, pos = posicionDe(f);
    return { id: x.id, nombre: String(f.puntoMedido || '').trim() || '(sin nombre)', lat: pos ? pos.lat : null, lon: pos ? pos.lon : null,
      este: String(f.este ?? '').trim(), norte: String(f.norte ?? '').trim(), cota: String(f.cotaOrtometrica ?? '').trim(), estado: textoEstado(x.estado), estadoClave: x.estado };
  }).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true }));
}
