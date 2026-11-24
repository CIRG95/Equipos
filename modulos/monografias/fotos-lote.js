// modulos/monografias/fotos-lote.js — v0.21.3 · Reparto de fotos en lote a las fichas (lógica pura, con pruebas).
// Orden: 1) por el nombre del archivo («PR-3_pano.jpg» → PR-3); 2) por el GPS de la foto (la ficha más cercana,
// a menos de 30 m); 3) el resto queda para asignar a mano. Las fotos reenviadas por WhatsApp no traen GPS.

export const TIPOS = [['panoramicaImg', 'Panorámica'], ['croquisImg', 'Croquis'], ['extra', 'Adicional']];
export const DISTANCIA_MAXIMA_M = 30;

export const normNombre = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

/** Ficha cuyo nombre aparece en el nombre del archivo (la coincidencia más larga; «PR-1» no calza con «PR-10»). */
export function fichaPorNombre(archivo, fichas) {
  const base = normNombre(String(archivo || '').replace(/\.[a-z0-9]+$/i, ''));
  let mejor = null, largo = 0;
  for (const f of fichas) {
    const n = normNombre(f.nombre);
    if (!n || n.length <= largo) continue;
    let i = base.indexOf(n);
    while (i >= 0) {
      const sig = base[i + n.length] || '', ant = base[i - 1] || '';
      if (!/\d/.test(sig) && !(/\d/.test(n[0]) && /\d/.test(ant))) { mejor = f; largo = n.length; break; }
      i = base.indexOf(n, i + 1);
    }
  }
  return mejor;
}

/** Tipo según el nombre del archivo, o null. */
export function tipoPorNombre(archivo) {
  const t = normNombre(archivo);
  if (/croquis|ubicacion/.test(t)) return 'croquisImg';
  if (/pano|panoramica|vista/.test(t)) return 'panoramicaImg';
  return null;
}

/** Distancia en metros entre dos puntos geográficos (haversine). */
export function distanciaM(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180, R = 6371000;
  const a = Math.sin((lat2 - lat1) * r / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lon2 - lon1) * r / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Ficha más cercana a la posición de la foto (fichas con { lat, lon }), si está a menos de maxM. */
export function fichaPorGps(gps, fichas, maxM = DISTANCIA_MAXIMA_M) {
  if (!gps) return null;
  let mejor = null, d0 = Infinity;
  for (const f of fichas) {
    if (f.lat == null || f.lon == null) continue;
    const d = distanciaM(gps.lat, gps.lon, f.lat, f.lon);
    if (d < d0) { d0 = d; mejor = f; }
  }
  return mejor && d0 <= maxM ? { ficha: mejor, distancia: d0 } : null;
}

/**
 * Asigna ficha, origen y tipo a cada foto. fotos: [{ nombre, gps }]; fichas: [{ id, nombre, lat, lon, tienePano, tieneCroquis }].
 * Devuelve copias con { fichaId, origen: 'nombre'|'gps'|null, distancia, tipo }.
 */
export function repartir(fotos, fichas) {
  const salida = fotos.map(f => {
    const porNombre = fichaPorNombre(f.nombre, fichas);
    if (porNombre) return { ...f, fichaId: porNombre.id, origen: 'nombre', distancia: null };
    const g = fichaPorGps(f.gps, fichas);
    if (g) return { ...f, fichaId: g.ficha.id, origen: 'gps', distancia: g.distancia };
    return { ...f, fichaId: null, origen: null, distancia: null };
  });
  return tiposPorDefecto(salida, fichas);
}

/** Tipo de cada foto: el del nombre; si no, la primera de una ficha sin panorámica es la panorámica y el resto adicionales. */
export function tiposPorDefecto(fotos, fichas) {
  const porId = new Map(fichas.map(f => [f.id, f]));
  const conPano = new Set(fotos.filter(f => f.fichaId && (f.tipo || tipoPorNombre(f.nombre)) === 'panoramicaImg').map(f => f.fichaId));
  return fotos.map(f => {
    if (f.tipo) return f;
    let tipo = tipoPorNombre(f.nombre);
    if (!tipo && f.fichaId) {
      const fi = porId.get(f.fichaId);
      if (fi && !fi.tienePano && !conPano.has(f.fichaId)) { tipo = 'panoramicaImg'; conPano.add(f.fichaId); }
    }
    return { ...f, tipo: tipo || 'extra' };
  });
}

/** Reparte las fotos sin ficha, en su orden, a las fichas (en su orden) que aún no tienen foto en este lote. */
export function repartirEnOrden(fotos, fichas) {
  const usadas = new Set(fotos.filter(f => f.fichaId).map(f => f.fichaId));
  const libres = fichas.filter(f => !usadas.has(f.id));
  let k = 0;
  const salida = fotos.map(f => (f.fichaId || k >= libres.length ? f : { ...f, fichaId: libres[k++].id, origen: 'orden', tipo: null }));
  return tiposPorDefecto(salida, fichas);
}

// ─────────── GPS de la foto (EXIF de JPEG) ───────────
/** { lat, lon } desde los primeros KB de un JPEG, o null (sin EXIF, sin GPS o no es JPEG). */
export function gpsDeJpeg(buffer) {
  try {
    const v = new DataView(buffer);
    if (v.byteLength < 4 || v.getUint16(0) !== 0xFFD8) return null;
    let p = 2;
    while (p + 4 <= v.byteLength) {
      const marca = v.getUint16(p), largo = v.getUint16(p + 2);
      if (marca === 0xFFE1 && v.getUint32(p + 4) === 0x45786966) return gpsDeTiff(v, p + 10);
      if ((marca & 0xFF00) !== 0xFF00 || marca === 0xFFDA) return null;
      p += 2 + largo;
    }
  } catch { /* archivo cortado o raro */ }
  return null;
}
function gpsDeTiff(v, t) {
  const le = v.getUint16(t) === 0x4949;
  const u16 = o => v.getUint16(t + o, le), u32 = o => v.getUint32(t + o, le);
  const entradas = ifd => { const n = u16(ifd), m = new Map(); for (let i = 0; i < n; i++) { const e = ifd + 2 + i * 12; m.set(u16(e), { tipo: u16(e + 2), n: u32(e + 4), off: e + 8 }); } return m; };
  const gpsPtr = entradas(u32(4)).get(0x8825);
  if (!gpsPtr) return null;
  const g = entradas(u32(gpsPtr.off));
  const ref = tag => { const e = g.get(tag); return e ? String.fromCharCode(v.getUint8(t + e.off)) : ''; };
  const grados = tag => {
    const e = g.get(tag); if (!e || e.n < 3) return null;
    const o = u32(e.off), r = k => { const d = u32(o + k * 8 + 4); return d ? u32(o + k * 8) / d : 0; };
    return r(0) + r(1) / 60 + r(2) / 3600;
  };
  let lat = grados(2), lon = grados(4);
  if (lat == null || lon == null || (lat === 0 && lon === 0)) return null;
  if (ref(1) === 'S') lat = -lat;
  if (ref(3) === 'W') lon = -lon;
  return { lat, lon };
}
