// modulos/vuelos/pronostico.js — pronóstico por hora para volar.
// Fuentes: Open-Meteo (modelos ECMWF, GFS e ICON; gratis para uso no comercial) y NOAA SWPC (índice Kp).
// Es una ayuda para planificar: no reemplaza la evaluación del piloto ni la información aeronáutica oficial.

const MODELOS = [['ecmwf_ifs025', 'ECMWF'], ['gfs_seamless', 'GFS'], ['icon_seamless', 'ICON']];
const VARIABLES = ['wind_speed_10m', 'wind_speed_80m', 'wind_speed_100m', 'wind_speed_120m', 'wind_direction_120m', 'wind_direction_100m',
  'wind_gusts_10m', 'precipitation', 'precipitation_probability', 'cloud_cover', 'temperature_2m'];

export async function pedirPronostico(lat, lon, dias = 3) {
  const url = 'https://api.open-meteo.com/v1/forecast?' + new URLSearchParams({
    latitude: lat.toFixed(4), longitude: lon.toFixed(4), hourly: VARIABLES.join(','),
    models: MODELOS.map(m => m[0]).join(','), wind_speed_unit: 'ms', timezone: 'America/Santiago',
    forecast_days: String(dias), daily: 'sunrise,sunset',
  });
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Open-Meteo respondió ${r.status}`);
  return ordenar(await r.json(), lat, lon);
}

function serie(h, variable, modelo) { return h[`${variable}_${modelo}`] || h[variable] || []; }
const primero = (...vals) => vals.find(v => v != null && isFinite(v)) ?? null;

function ordenar(json, lat, lon) {
  const h = json.hourly || {};
  const horas = (h.time || []).map((t, i) => {
    const porModelo = MODELOS.map(([m, nombre]) => {
      const v10 = serie(h, 'wind_speed_10m', m)[i];
      const vAlt = primero(serie(h, 'wind_speed_120m', m)[i], serie(h, 'wind_speed_100m', m)[i], serie(h, 'wind_speed_80m', m)[i]);
      const g10 = serie(h, 'wind_gusts_10m', m)[i];
      // Ráfaga a la altura de vuelo: estimada escalando la ráfaga de 10 m por el aumento del viento con la altura.
      const gAlt = g10 != null && vAlt != null && v10 ? Math.max(vAlt, g10 * vAlt / v10) : primero(g10);
      return {
        nombre, v: vAlt, g: gAlt,
        dir: primero(serie(h, 'wind_direction_120m', m)[i], serie(h, 'wind_direction_100m', m)[i]),
        lluvia: serie(h, 'precipitation', m)[i], prob: serie(h, 'precipitation_probability', m)[i],
        nubes: serie(h, 'cloud_cover', m)[i], temp: serie(h, 'temperature_2m', m)[i],
      };
    }).filter(x => x.v != null);
    const prom = k => { const xs = porModelo.map(x => x[k]).filter(v => v != null && isFinite(v)); return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null; };
    const vs = porModelo.map(x => x.v);
    return {
      t, fecha: t.slice(0, 10), hora: Number(t.slice(11, 13)),
      v: prom('v'), vMin: vs.length ? Math.min(...vs) : null, vMax: vs.length ? Math.max(...vs) : null,
      g: prom('g'), dir: prom('dir'), lluvia: prom('lluvia'), prob: prom('prob'), nubes: prom('nubes'), temp: prom('temp'),
      modelos: porModelo.length, sol: elevacionSol(t, lat, lon),
    };
  });
  const dias = (json.daily?.time || []).map((f, i) => ({ fecha: f, salida: json.daily.sunrise?.[i], puesta: json.daily.sunset?.[i] }));
  return { lat, lon, horas, dias, elevacionModelo: json.elevation };
}

/** Índice Kp previsto (NOAA SWPC). Devuelve [{ t, kp }] o null si no se pudo leer. */
export async function pedirKp() {
  try {
    const r = await fetch('https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json');
    if (!r.ok) return null;
    const filas = await r.json();
    return filas.slice(1).map(f => ({ t: String(f[0]).replace(' ', 'T') + 'Z', kp: Number(f[1]) })).filter(x => isFinite(x.kp));
  } catch { return null; }
}

/** Kp máximo en la ventana de 3 h que contiene la hora local dada. */
export function kpEnHora(kps, horaLocalIso) {
  if (!kps || !kps.length) return null;
  const t = new Date(horaLocalIso + ':00-03:00').getTime();
  const fila = kps.filter(k => { const ini = new Date(k.t).getTime(); return t >= ini && t < ini + 3 * 3600e3; });
  return fila.length ? Math.max(...fila.map(f => f.kp)) : null;
}

/** Elevación aproximada del sol (grados) para una hora local de Chile continental. */
export function elevacionSol(horaLocalIso, lat, lon) {
  const d = new Date(horaLocalIso + ':00-03:00');
  const dia = (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5;
  const g = 2 * Math.PI / 365 * (dia - 1 + (d.getUTCHours() - 12) / 24);
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const minutosSolares = d.getUTCHours() * 60 + d.getUTCMinutes() + eqt + 4 * lon;
  const ha = (minutosSolares / 4 - 180) * Math.PI / 180;
  const la = lat * Math.PI / 180;
  const cosZ = Math.sin(la) * Math.sin(decl) + Math.cos(la) * Math.cos(decl) * Math.cos(ha);
  return 90 - Math.acos(Math.min(1, Math.max(-1, cosZ))) * 180 / Math.PI;
}

/** Estado de una hora para un dron: 'go' | 'marg' | 'no' | 'noche', con los motivos. */
export function evaluarHora(h, dron, { kp = null, solMin = 0 } = {}) {
  if (h.sol != null && h.sol < solMin) return { estado: 'noche', motivos: ['Sin luz suficiente'] };
  const no = [], marg = [];
  if (h.v != null && h.v > dron.vientoMaxMs) no.push(`Viento ${h.v.toFixed(1)} m/s`);
  else if (h.v != null && h.v > 0.8 * dron.vientoMaxMs) marg.push(`Viento ${h.v.toFixed(1)} m/s`);
  if (h.g != null && h.g > dron.rafagaMaxMs) no.push(`Ráfaga ${h.g.toFixed(1)} m/s`);
  else if (h.g != null && h.g > 0.8 * dron.rafagaMaxMs) marg.push(`Ráfaga ${h.g.toFixed(1)} m/s`);
  if (h.lluvia != null && h.lluvia >= 0.2) no.push('Lluvia');
  else if (h.prob != null && h.prob >= 40) marg.push(`Prob. lluvia ${Math.round(h.prob)} %`);
  if (h.vMax != null && h.vMin != null && h.vMax - h.vMin > 4) marg.push('Modelos no coinciden');
  if (h.temp != null && h.temp < 0) marg.push('Bajo 0 °C (baterías)');
  if (kp != null && kp >= 5) marg.push(`Kp ${kp} (GNSS)`);
  return { estado: no.length ? 'no' : marg.length ? 'marg' : 'go', motivos: [...no, ...marg] };
}

export const ENLACES_CONSULTA = [
  ['NOTAM — AIP Chile (oficial)', 'https://aipchile.dgac.gob.cl/notam'],
  ['Mapa interactivo — AIP Chile', 'https://aipchile.dgac.gob.cl/'],
  ['UAS Control (zonas)', 'https://uascontrol.io/'],
  ['Visor de zonas — Vuelatudrone', 'https://vuelatudrone.cl/visor-zonas-vuelo/index.html?v=2'],
  ['Windy', 'https://www.windy.com/'],
];
