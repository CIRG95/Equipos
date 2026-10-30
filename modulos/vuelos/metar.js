// modulos/vuelos/metar.js — METAR y TAF del aeródromo con reporte más cercano (NOAA Aviation Weather Center).
// Si el servicio no responde desde la app (sin internet o bloqueado), se ofrece el enlace para revisarlo a mano.

const AWC = 'https://aviationweather.gov/api/data/metar';

/** Busca METAR/TAF en un cuadro de ~120 km alrededor del punto y devuelve el más cercano con su distancia. */
export async function metarCercano(lat, lon) {
  const d = 1.1; // grados (~120 km)
  const url = `${AWC}?${new URLSearchParams({ bbox: `${(lat - d).toFixed(2)},${(lon - d).toFixed(2)},${(lat + d).toFixed(2)},${(lon + d).toFixed(2)}`, format: 'json', taf: 'true', hours: '3' })}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`AWC respondió ${r.status}`);
  const lista = await r.json();
  if (!Array.isArray(lista) || !lista.length) return null;
  const km = (a, b, c, e) => Math.hypot((c - a) * 110.54, (e - b) * 111.32 * Math.cos(a * Math.PI / 180));
  const porEstacion = new Map();
  for (const m of lista) {
    if (!m || !m.icaoId) continue;
    const prev = porEstacion.get(m.icaoId);
    if (!prev || String(m.reportTime || m.obsTime) > String(prev.reportTime || prev.obsTime)) porEstacion.set(m.icaoId, m);
  }
  const estaciones = [...porEstacion.values()].map(m => ({ ...m, km: km(lat, lon, m.lat, m.lon) })).sort((a, b) => a.km - b.km);
  const m = estaciones[0];
  return { icao: m.icaoId, nombre: m.name || m.icaoId, km: m.km, metar: m.rawOb || '', taf: m.rawTaf || '', hora: m.reportTime || '', viento: vientoDeMetar(m.rawOb || '') };
}

/** Viento del METAR en m/s: { dir, v, g } o null. */
export function vientoDeMetar(raw) {
  const x = /\b(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?(KT|MPS)\b/.exec(raw);
  if (!x) return null;
  const f = x[4] === 'KT' ? 0.5144 : 1;
  return { dir: x[1] === 'VRB' ? null : Number(x[1]), v: Number(x[2]) * f, g: x[3] ? Number(x[3]) * f : null };
}

export const enlaceMetar = icao => icao ? `https://aviationweather.gov/data/metar/?id=${icao}&taf=1` : 'https://aipchile.dgac.gob.cl/';
