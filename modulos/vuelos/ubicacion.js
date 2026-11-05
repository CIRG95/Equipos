// modulos/vuelos/ubicacion.js — comuna, región y país de un punto (v0.11).
// Usa la búsqueda inversa de OpenStreetMap (Nominatim): una consulta por área cargada, con caché en memoria.
// Si no hay internet, la hoja deja escribirlas a mano. En Chile solo se muestran comuna y región.

const cache = new Map();

/** Quita «Región de», «Región del» o «Región» del nombre que entrega OpenStreetMap. */
export const limpiarRegion = t => String(t || '').replace(/^Regi[oó]n\s+(de\s+la\s+|del\s+|de\s+)?/i, '').trim();

/** → { comuna, region, pais, codigoPais } o lanza Error. */
export async function ubicacionDe(lat, lon) {
  const clave = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  if (cache.has(clave)) return cache.get(clave);
  const url = 'https://nominatim.openstreetmap.org/reverse?' + new URLSearchParams({ format: 'jsonv2', lat: lat.toFixed(5), lon: lon.toFixed(5), zoom: '10', addressdetails: '1', 'accept-language': 'es' });
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`OpenStreetMap respondió ${r.status}`);
  const j = await r.json();
  const a = j.address || {};
  const out = {
    comuna: a.municipality || a.city || a.town || a.village || a.county || '',
    region: limpiarRegion(a.state || a.region || ''),
    pais: a.country || '', codigoPais: (a.country_code || '').toUpperCase(),
  };
  cache.set(clave, out);
  return out;
}

/** Texto corto: «Comuna, Región» (y el país si no es Chile). */
export function textoUbicacion(u) {
  if (!u) return '';
  return [u.comuna, u.region, u.codigoPais && u.codigoPais !== 'CL' ? u.pais : ''].filter(Boolean).join(', ');
}
