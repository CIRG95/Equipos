// modulos/monografias/coordenadas.js — listas de datums, zonas y geoides, y formato de coordenadas geodésicas (v0.11).
// La monografía guarda las coordenadas como texto (lo que se transcribe del postproceso): aquí solo se leen y se escriben
// en el formato elegido (grados decimales o grados, minutos y segundos, con la cantidad de decimales que se pida).

export const DATUMS_CHILE = ['SIRGAS-Chile 2021', 'SIRGAS-Chile 2016', 'SIRGAS-Chile 2013', 'SIRGAS-Chile 2002', 'WGS84', 'PSAD56', 'SAD69'];
export const GEOIDES = ['EGM2008', 'EGM96', 'Modelo geoidal local'];
export const ZONAS_POR_PAIS = {
  Chile: ['18 S', '19 S', '17 S (Juan Fernández)', '12 S (Isla de Pascua)'],
  'Perú': ['17 S', '18 S', '19 S'],
  Argentina: ['19 S', '20 S', '21 S'],
  Bolivia: ['19 S', '20 S', '21 S'],
};

/** Lee una latitud o longitud en grados decimales («-33.1234», «33.1234 S») o sexagesimales («33°07'24.4"S»). → número o null. */
export function leerGrados(texto) {
  let t = String(texto ?? '').trim().replace(/,/g, '.').toUpperCase();
  if (!t) return null;
  const sur = /[SWO]\s*$/.test(t) || /^[SWO]/.test(t) || t.startsWith('-');
  t = t.replace(/[NSEWO]/g, ' ').replace(/^-/, '').trim();
  const nums = t.match(/\d+(?:\.\d+)?/g);
  if (!nums) return null;
  const [g, m = 0, s = 0] = nums.map(Number);
  const v = g + m / 60 + s / 3600;
  if (!isFinite(v)) return null;
  return sur ? -v : v;
}

/** Escribe grados: formato 'dd' (−33,123456°) o 'dms' (33°07'24,44" S). eje: 'lat' | 'lon'. */
export function escribirGrados(v, eje, formato = 'dms', dec = 4) {
  if (v == null || !isFinite(v)) return '';
  const n = Math.max(0, Math.min(8, Number(dec) || 0));
  if (formato === 'dd') return `${v.toFixed(n).replace('.', ',')}°`;
  const hem = eje === 'lat' ? (v < 0 ? 'S' : 'N') : (v < 0 ? 'O' : 'E');
  const a = Math.abs(v);
  let g = Math.floor(a), m = Math.floor((a - g) * 60), s = ((a - g) * 60 - m) * 60;
  if (Number(s.toFixed(n)) >= 60) { s = 0; m += 1; }
  if (m >= 60) { m = 0; g += 1; }
  return `${g}°${String(m).padStart(2, '0')}'${s.toFixed(n).replace('.', ',').padStart(n ? n + 3 : 2, '0')}" ${hem}`;
}
