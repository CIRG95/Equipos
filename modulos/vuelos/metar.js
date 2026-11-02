// modulos/vuelos/metar.js — METAR sin consulta automática (Sistema v0.7).
// Los servicios de METAR (NOAA, AIP Chile, MeteoChile) no dejan que una página los lea desde el navegador,
// así que la app: 1) dice cuáles son los aeródromos con METAR más cercanos (lista oficial de NOAA en
// vendor/capas/metar-estaciones.json), 2) el usuario copia el METAR y lo pega, 3) la app lo decodifica y lo compara
// con los límites del dron y con el pronóstico. La consulta automática (intermediario propio) queda para después.

const NUDO = 0.514444, PIE = 0.3048, MILLA = 1609.34;
const RUMBOS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];

// La lista (≈4 KB) va dentro del programa: así sirve sin conexión y también en el paquete para Terreno.
import datosEstaciones from '../../vendor/capas/metar-estaciones.json' with { type: 'json' };

let estaciones = null;
/** Compatibilidad: la lista ya viene cargada. */
export async function cargarEstaciones() { return estaciones; }
/** [[icao, nombre, lat, lon, elev, 'MT']] → lista interna (también para pruebas). */
export function fijarEstaciones(lista) {
  estaciones = lista.map(([icao, nombre, lat, lon, elev, emite]) => ({ icao, nombre, lat, lon, elev, taf: emite.includes('T') }));
}
fijarEstaciones(datosEstaciones.estaciones);

const kmEntre = (a, b, c, d) => Math.hypot((c - a) * 110.54, (d - b) * 111.32 * Math.cos(a * Math.PI / 180));
const rumbo = (a, b, c, d) => (Math.atan2((d - b) * Math.cos(a * Math.PI / 180), c - a) * 180 / Math.PI + 360) % 360;

/** Los n aeródromos con METAR más cercanos a (lat, lon): [{ icao, nombre, km, rumbo, hacia: 'al SO', elev, taf }] */
export function cercanas(lat, lon, n = 3) {
  if (!estaciones) return [];
  return estaciones.map(e => ({ ...e, km: kmEntre(lat, lon, e.lat, e.lon), rumbo: rumbo(lat, lon, e.lat, e.lon) }))
    .sort((a, b) => a.km - b.km).slice(0, n)
    .map(e => ({ ...e, hacia: `al ${RUMBOS[Math.round(e.rumbo / 45) % 8]}` }));
}

/** ¿Qué tan representativo es? km > 50 o más de 500 m de diferencia de altura → solo referencia. */
export function representatividad(est, elevArea = null) {
  const motivos = [];
  if (est.km > 50) motivos.push(`está a ${Math.round(est.km)} km`);
  if (elevArea != null && Math.abs(elevArea - est.elev) > 500) motivos.push(`${Math.round(Math.abs(elevArea - est.elev))} m de diferencia de altura`);
  return { buena: !motivos.length, motivos };
}

export const enlaces = icao => [
  ['AIP Chile', 'https://aipchile.dgac.gob.cl/metar'],
  ['MeteoChile', 'https://www.meteochile.gob.cl/PortalDMC-web/metaer/home.xhtml'],
  ['NOAA (texto)', `https://aviationweather.gov/api/data/metar?ids=${encodeURIComponent(icao)}&format=raw&taf=true&hours=3`],
];

// ─────────── Decodificar ───────────
const FENOMENOS = {
  RA: 'lluvia', DZ: 'llovizna', SN: 'nieve', SG: 'cinarra', GR: 'granizo', GS: 'granizo pequeño', PL: 'hielo granulado', UP: 'precipitación',
  FG: 'niebla', BR: 'neblina', HZ: 'calima', FU: 'humo', DU: 'polvo', SA: 'arena', VA: 'ceniza', TS: 'tormenta', SH: 'chubascos',
  SQ: 'turbonada', FC: 'tromba', DS: 'tempestad de polvo', SS: 'tempestad de arena', PO: 'remolinos de polvo', FZ: 'engelante',
  MI: 'baja', BC: 'en bancos', PR: 'parcial', DR: 'arrastrada', BL: 'levantada', VC: 'en las cercanías',
};
const CANT = { FEW: 'pocas (1–2/8)', SCT: 'dispersas (3–4/8)', BKN: 'fragmentadas (5–7/8)', OVC: 'cubierto (8/8)', VV: 'cielo invisible' };

function fenomeno(tok) {
  const m = /^([+-]|VC)?((?:MI|BC|PR|DR|BL|SH|TS|FZ))?((?:DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PO|SQ|FC|SS|DS)+)?$/.exec(tok);
  if (!m || (!m[2] && !m[3])) return null;
  const partes = [];
  if (m[3]) for (let i = 0; i < m[3].length; i += 2) partes.push(FENOMENOS[m[3].slice(i, i + 2)]);
  if (m[2]) partes.push(FENOMENOS[m[2]]);
  if (m[1] === '-') partes.push('débil'); else if (m[1] === '+') partes.push('fuerte'); else if (m[1] === 'VC') partes.push('en las cercanías');
  return { codigo: tok, texto: partes.filter(Boolean).join(' ') };
}

function horaReporte(ddhhmm, ahora = new Date()) {
  const d = Number(ddhhmm.slice(0, 2)), h = Number(ddhhmm.slice(2, 4)), mi = Number(ddhhmm.slice(4, 6));
  let f = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), d, h, mi));
  if (f - ahora > 36e5 * 24) f = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - 1, d, h, mi));
  return f;
}

/** Categoría de vuelo como la de NOAA: VFR, MVFR, IFR, LIFR (techo en pies y visibilidad). */
export function categoria(techoPies, visM) {
  const sm = visM == null ? null : visM / MILLA;
  if ((techoPies != null && techoPies < 500) || (sm != null && sm < 1)) return 'LIFR';
  if ((techoPies != null && techoPies < 1000) || (sm != null && sm < 3)) return 'IFR';
  if ((techoPies != null && techoPies <= 3000) || (sm != null && sm <= 5)) return 'MVFR';
  return 'VFR';
}

/** Un METAR o SPECI → objeto decodificado (o null si no se reconoce). */
export function decodificarUno(texto, ahora = new Date()) {
  const t = String(texto).replace(/=+\s*$/, '').trim();
  const cab = /^(?:(METAR|SPECI)\s+)?(?:COR\s+)?([A-Z]{4})\s+(\d{6})Z\s+(.*)$/s.exec(t);
  if (!cab) return null;
  const r = { tipo: cab[1] || 'METAR', icao: cab[2], hora: horaReporte(cab[3], ahora), texto: `${cab[1] || 'METAR'} ${cab[2]} ${cab[3]}Z ${cab[4]}`.replace(/\s+/g, ' ').trim(),
    viento: null, visibilidadM: null, cavok: false, nubes: [], fenomenos: [], temp: null, rocio: null, qnh: null, tendencia: '' };
  const toks = cab[4].split(/\s+/);
  for (let i = 0; i < toks.length; i++) {
    const k = toks[i];
    if (k === 'RMK') break;
    if (/^(NOSIG|BECMG|TEMPO)$/.test(k)) { r.tendencia = toks.slice(i).join(' '); break; }
    let m;
    if ((m = /^(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?(KT|MPS)$/.exec(k))) {
      const f = m[4] === 'KT' ? NUDO : 1;
      r.viento = { dir: m[1] === 'VRB' ? null : Number(m[1]), ms: Number(m[2]) * f, rafMs: m[3] ? Number(m[3]) * f : null, kt: m[4] === 'KT' ? Number(m[2]) : Number(m[2]) / NUDO, rafKt: m[3] ? (m[4] === 'KT' ? Number(m[3]) : Number(m[3]) / NUDO) : null };
    } else if ((m = /^(\d{3})V(\d{3})$/.exec(k)) && r.viento) { r.viento.varDe = Number(m[1]); r.viento.varA = Number(m[2]); }
    else if (k === 'CAVOK') { r.cavok = true; r.visibilidadM = 10000; }
    else if (/^\d{4}$/.test(k) && r.visibilidadM == null) r.visibilidadM = k === '9999' ? 10000 : Number(k);
    else if ((m = /^(P)?(\d+)(?:\/(\d+))?SM$/.exec(k))) r.visibilidadM = (m[3] ? Number(m[2]) / Number(m[3]) : Number(m[2])) * MILLA;
    else if ((m = /^(FEW|SCT|BKN|OVC|VV)(\d{3}|\/\/\/)(CB|TCU)?$/.exec(k))) r.nubes.push({ cant: m[1], texto: CANT[m[1]], pies: m[2] === '///' ? null : Number(m[2]) * 100, m: m[2] === '///' ? null : Math.round(Number(m[2]) * 100 * PIE), tipo: m[3] || '' });
    else if (/^(NSC|SKC|CLR|NCD)$/.test(k)) r.sinNubes = true;
    else if ((m = /^(M?\d{2})\/(M?\d{2})?$/.exec(k))) { const n = s => s ? Number(s.replace('M', '-')) : null; r.temp = n(m[1]); r.rocio = n(m[2]); }
    else if ((m = /^Q(\d{4})$/.exec(k))) r.qnh = Number(m[1]);
    else if ((m = /^A(\d{4})$/.exec(k))) r.qnh = Math.round(Number(m[1]) / 100 * 33.8639);
    else { const f = fenomeno(k); if (f) r.fenomenos.push(f); }
  }
  const techo = r.nubes.filter(n => ['BKN', 'OVC', 'VV'].includes(n.cant) && n.pies != null).map(n => n.pies);
  r.techoPies = techo.length ? Math.min(...techo) : null;
  r.categoria = categoria(r.techoPies, r.visibilidadM);
  return r;
}

/** Texto pegado (uno o varios reportes, con TAF o con el resumen en castellano de AIP Chile) → { metars: [...], taf: 'texto' } */
export function decodificar(texto, ahora = new Date()) {
  const limpio = String(texto || '').replace(/\r/g, '');
  const metars = [];
  const re = /(?:^|\s)((?:METAR|SPECI)\s+(?:COR\s+)?[A-Z]{4}\s+\d{6}Z[^=\n]*|[A-Z]{4}\s+\d{6}Z\s+(?:AUTO\s+)?(?:\d{3}|VRB)\d{2,3}(?:G\d{2,3})?(?:KT|MPS)[^=\n]*)/g;
  let m;
  while ((m = re.exec(limpio))) {
    const d = decodificarUno(m[1].replace(/\bAUTO\b/, ''), ahora);
    if (d && !metars.some(x => x.texto === d.texto)) metars.push(d);
  }
  const taf = /TAF\s+(?:AMD\s+|COR\s+)?[A-Z]{4}\s+\d{6}Z[\s\S]*?(?:=|$)/.exec(limpio);
  metars.sort((a, b) => b.hora - a.hora);
  return { metars, taf: taf ? taf[0].replace(/\s+/g, ' ').trim() : '' };
}

/**
 * Comparación con los límites del dron y con el pronóstico de esa hora.
 * dron: { vientoMaxMs, rafagaMaxMs }; horaPron: fila del pronóstico ({ v, g }) para la hora del METAR, o null.
 * Devuelve [{ texto, nivel: 'ok'|'aviso'|'no' }].
 */
export function comparar(m, dron, horaPron = null) {
  const out = [];
  if (m.viento) {
    const v = m.viento.ms, g = m.viento.rafMs;
    out.push({ texto: `Viento ${m.viento.dir == null ? 'variable' : m.viento.dir + '°'} ${v.toFixed(1)} m/s${g ? `, ráfagas ${g.toFixed(1)} m/s` : ''} (en el aeródromo, a 10 m)`,
      nivel: v > dron.vientoMaxMs || (g && g > dron.rafagaMaxMs) ? 'no' : v > 0.8 * dron.vientoMaxMs || (g && g > 0.8 * dron.rafagaMaxMs) ? 'aviso' : 'ok' });
  }
  if (m.visibilidadM != null) out.push({ texto: m.cavok ? 'CAVOK: visibilidad 10 km o más, sin nubes bajas' : `Visibilidad ${m.visibilidadM >= 10000 ? '10 km o más' : (m.visibilidadM / 1000).toFixed(1) + ' km'}`, nivel: m.visibilidadM < 3000 ? 'no' : m.visibilidadM < 5000 ? 'aviso' : 'ok' });
  if (m.techoPies != null) out.push({ texto: `Techo de nubes a ${Math.round(m.techoPies * PIE)} m (${m.techoPies} pies)`, nivel: m.techoPies * PIE < 300 ? 'aviso' : 'ok' });
  for (const f of m.fenomenos) out.push({ texto: `Fenómeno: ${f.texto} (${f.codigo})`, nivel: /TS|GR|\+/.test(f.codigo) ? 'no' : /RA|DZ|SN|FG|SH/.test(f.codigo) ? 'aviso' : 'ok' });
  if (m.temp != null) out.push({ texto: `Temperatura ${m.temp} °C${m.rocio != null ? ` · punto de rocío ${m.rocio} °C` : ''}`, nivel: m.temp < 5 ? 'aviso' : 'ok' });
  if (m.temp != null && m.rocio != null && m.temp - m.rocio <= 2) out.push({ texto: 'Temperatura y rocío muy cerca: posible niebla o condensación en la cámara', nivel: 'aviso' });
  if (horaPron && horaPron.v != null && m.viento) {
    out.push({ texto: `El pronóstico decía ${horaPron.v.toFixed(1)} m/s a 120 m para esa hora; el METAR mide ${m.viento.ms.toFixed(1)} m/s a 10 m. A 120 m el viento suele ser mayor que en superficie.`, nivel: m.viento.ms > horaPron.v + 3 ? 'aviso' : 'ok' });
  }
  return out;
}

/** Minutos desde el reporte. */
export const antiguedadMin = (m, ahora = new Date()) => Math.round((ahora - m.hora) / 60000);
