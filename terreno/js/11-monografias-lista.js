"use strict";

/* =========================================================================
   TAB: MONOGRAFÍAS (GNSS)
   Fichas de punto estilo "Monografía de PRs y Monolitos": datos de cliente/
   proyecto, coordenadas UTM y Geodésicas, croquis + foto panorámica,
   descripción y firma. Cada una puede partir de cero o de un punto GNSS ya
   capturado en algún Levantamiento. Los módulos (qué secciones van en el
   PDF) son configurables por ficha, con sticky-defaults del último registro.
   ========================================================================= */

/* v0.1k — Datos comunes (quién levantó / revisó y fechas): se escriben una vez y se
   aplican a las monografías nuevas (si está activado) o a las existentes (botón). */
const MONO_COMUNES_KEY = "monoComunes";
const MONO_COMUNES_CAMPOS = ["ubicacion", "localidad", "comuna", "region", "operadorNombre", "operadorCargo", "fechaMedicion", "revisoNombre", "fechaRevision"];
function cargarMonoComunes() {
  let c = null;
  try { c = JSON.parse(localStorage.getItem(MONO_COMUNES_KEY) || "null"); } catch (_) {}
  c = c || {};
  const o = { activo: !!c.activo, formatoGeo: c.formatoGeo === "dec" || c.formatoGeo === "dms" ? c.formatoGeo : "", decimales: Number.isFinite(c.decimales) ? c.decimales : (c.formatoGeo === "dms" ? 5 : 6) };
  MONO_COMUNES_CAMPOS.forEach((k) => { o[k] = c[k] || ""; });
  return o;
}
function guardarMonoComunes(c) { try { localStorage.setItem(MONO_COMUNES_KEY, JSON.stringify(c)); } catch (_) {} }
function aplicarComunesA(m, c) {   // solo copia los campos que tienen valor; nunca borra
  let n = 0;
  MONO_COMUNES_CAMPOS.forEach((k) => { if (c[k] && m[k] !== c[k]) { m[k] = c[k]; n++; } });
  n += normalizarGeoMono(m, c).cambios;
  return n;
}

/* Formato de las geográficas: decimal (dd.dddd) o grados° minutos' segundos" — se elige en Datos comunes */
function parseGeo(s) { const r = impNum(String(s == null ? "" : s).trim(), "punto", true); return r ? r.v : null; }
function fmtGeo(v, eje, formato, nd) {
  nd = Math.max(0, Math.min(8, nd == null ? 6 : nd));
  if (formato === "dec") return v.toFixed(nd);
  const hem = eje === "lat" ? (v < 0 ? "S" : "N") : (v < 0 ? "W" : "E");
  let a = Math.abs(v), g = Math.floor(a), mi = Math.floor((a - g) * 60);
  let se = (a - g - mi / 60) * 3600;
  se = Number(se.toFixed(nd));
  if (se >= 60) { se = 0; mi += 1; }
  if (mi >= 60) { mi = 0; g += 1; }
  return g + "°" + String(mi).padStart(2, "0") + "'" + se.toFixed(nd).padStart(nd ? 3 + nd : 2, "0") + '"' + hem;
}
function geoSegunFormato(txt, eje, c) {
  c = c || cargarMonoComunes();
  const t = String(txt == null ? "" : txt).trim();
  if (!c.formatoGeo || !t) return t;
  const v = parseGeo(t);
  return v == null ? t : fmtGeo(v, eje, c.formatoGeo, c.decimales);
}
function normalizarGeoMono(m, c) {
  c = c || cargarMonoComunes();
  const r = { cambios: 0, sinEntender: 0 };
  if (!c.formatoGeo) return r;
  [["latitud", "lat"], ["longitud", "lng"]].forEach(([k, eje]) => {
    const antes = String(m[k] == null ? "" : m[k]).trim();
    if (!antes) return;
    const v = parseGeo(antes);
    if (v == null) { r.sinEntender++; return; }
    const nuevo = fmtGeo(v, eje, c.formatoGeo, c.decimales);
    if (nuevo !== antes) {
      if (m.calc && m.calc.geo && String(m.calc.geo[eje] || "").trim() === antes) m.calc.geo[eje] = nuevo;
      m[k] = nuevo; r.cambios++;
    }
  });
  return r;
}
function crearMonografiaDesdeDefaults() {
  const d = cargarMonografiaDefaults();
  const m0 = {
    id: uuid(),
    tituloDocumento: d.tituloDocumento,
    clienteNombre: d.clienteNombre, clienteLogo: d.clienteLogo,
    nombreProyecto: d.nombreProyecto,
    puntoMedido: "", ubicacion: "", localidad: "", comuna: "", region: "", provincia: "",
    datumUTM: d.datumUTM, zonaUTM: d.zonaUTM, norte: "", este: "", cotaOrtometrica: "",
    datumGeodesico: d.datumGeodesico, geoide: d.geoide, latitud: "", longitud: "", alturaElipsoidal: "",
    croquisImg: null, panoramicaImg: null,
    descripcion: "", equipoGNSS: d.equipoGNSS, tipoMedicion: d.tipoMedicion,
    operadorNombre: "", operadorCargo: "Geomensor", fechaMedicion: "",
    revisoNombre: "", fechaRevision: "",
    modulos: { ...d.modulos },
    creado: nowISO()
  };
  const com = cargarMonoComunes();
  if (com.activo) aplicarComunesA(m0, com);
  return m0;
}

/* Todos los puntos GNSS (Estático o RTK) capturados en cualquier jornada,
   más recientes primero — para la opción "crear desde un punto existente". */
function puntosGnssDisponibles() {
  const out = [];
  state.levantamientos.filter((l) => l.instrumento === "gnss").forEach((l) => {
    const j = state.jornadas.find((x) => x.id === l.jornadaId);
    l.puntos.forEach((p, i) => out.push({ lev: l, jornada: j, punto: p, idx: i }));
  });
  return out.sort((a, b) => new Date(b.punto.timestamp) - new Date(a.punto.timestamp));
}

/* v0.1g — Resumen por monografía: ✔ ingresado, – falta, triángulo ! repetido (mismo proyecto), triángulo ? calculado por la app */
function monoTriangulo(ch, titulo) {
  return `<svg width="18" height="16" viewBox="0 0 18 16" style="vertical-align:-3px;" role="img" aria-label="${escapeHtml(titulo)}"><title>${escapeHtml(titulo)}</title><path d="M9 1.2 L17 14.8 H1 Z" fill="#f2b705" stroke="#b58900" stroke-linejoin="round"/><text x="9" y="13" font-size="9.5" font-weight="700" text-anchor="middle" fill="#1a1a1a" font-family="sans-serif">${ch}</text></svg>`;
}
function monoResumenDatos(m) {
  const mod = m.modulos || {};
  const t = (v) => String(v == null ? "" : v).trim();
  const num = (v) => { const x = parseFloat(t(v).replace(",", ".")); return isFinite(x) ? x : null; };
  const mismas = state.monografias.filter((x) => x.id !== m.id && t(x.nombreProyecto) === t(m.nombreProyecto));
  const nombres = (arr) => arr.map((x) => t(x.puntoMedido) || "(sin punto)").join(", ");
  const dup = (fn) => mismas.filter(fn);
  const eq = (a, b) => { const x = num(a), y = num(b); return x != null && y != null && Math.abs(x - y) < 1e-9; };
  // Geográficas: pueden venir en grados° ' " o decimales; se comparan como grados decimales
  const geo = (v) => { const r = impNum(t(v), "punto", true); return r ? r.v : null; };
  const eqGeo = (a, b) => { const x = geo(a), y = geo(b); return x != null && y != null && Math.abs(x - y) < 1e-9; };
  const filas = [];
  // Punto
  const dPunto = dup((x) => t(x.puntoMedido).toLowerCase() === t(m.puntoMedido).toLowerCase() && t(m.puntoMedido) !== "");
  filas.push({ k: "Punto", ok: !!t(m.puntoMedido), det: t(m.puntoMedido), dup: dPunto.length ? "código repetido en este proyecto (" + dPunto.length + " más)" : "" });
  if (mod.utm !== false) {
    const ok = !!(t(m.norte) && t(m.este));
    const d = ok ? dup((x) => eq(x.norte, m.norte) && eq(x.este, m.este)) : [];
    filas.push({ k: "Coordenadas UTM", ok, det: ok ? "N " + t(m.norte) + " · E " + t(m.este) : (t(m.norte) || t(m.este) ? "incompletas" : ""),
      dup: d.length ? "mismas coordenadas que " + nombres(d) : "",
      calc: ok && m.calc && m.calc.utm && t(m.calc.utm.norte) === t(m.norte) && t(m.calc.utm.este) === t(m.este) ? "calculadas por la app desde las geográficas" : "" });
  }
  if (mod.geodesicas !== false) {
    const ok = !!(t(m.latitud) && t(m.longitud));
    const d = ok ? dup((x) => eqGeo(x.latitud, m.latitud) && eqGeo(x.longitud, m.longitud)) : [];
    filas.push({ k: "Geográficas", ok, det: ok ? t(m.latitud) + ", " + t(m.longitud) : (t(m.latitud) || t(m.longitud) ? "incompletas" : ""),
      dup: d.length ? "mismas coordenadas que " + nombres(d) : "",
      calc: ok && m.calc && m.calc.geo && t(m.calc.geo.lat) === t(m.latitud) && t(m.calc.geo.lng) === t(m.longitud) ? "calculadas por la app desde UTM" : "" });
    const okH = !!t(m.alturaElipsoidal);
    const dH = okH ? dup((x) => eq(x.alturaElipsoidal, m.alturaElipsoidal)) : [];
    filas.push({ k: "H. elipsoidal", ok: okH, det: t(m.alturaElipsoidal), dup: dH.length ? "mismo valor que " + nombres(dH) : "" });
  }
  if (mod.utm !== false || mod.geodesicas !== false) {
    const okC = !!t(m.cotaOrtometrica);
    const dC = okC ? dup((x) => eq(x.cotaOrtometrica, m.cotaOrtometrica)) : [];
    filas.push({ k: "Cota ortométrica", ok: okC, det: t(m.cotaOrtometrica), dup: dC.length ? "mismo valor que " + nombres(dC) : "" });
  }
  if (mod.croquis !== false) filas.push({ k: "Croquis", ok: !!m.croquisImg });
  if (mod.panoramica !== false) filas.push({ k: "Fotografía panorámica", ok: !!m.panoramicaImg });
  if (mod.fotos) { const n = (m.fotosExtra || []).filter((f) => f.img).length; filas.push({ k: "Fotos adicionales", ok: n > 0, det: n ? n + " foto" + (n === 1 ? "" : "s") : "" }); }
  return filas;
}
function monoResumenHtml(m) {
  const filas = monoResumenDatos(m);
  const avisos = [];
  const html = filas.map((f) => {
    const marcas = [];
    if (f.dup) { marcas.push(monoTriangulo("!", f.dup)); avisos.push("<strong>" + escapeHtml(f.k) + ":</strong> " + escapeHtml(f.dup)); }
    if (f.calc) { marcas.push(monoTriangulo("?", f.calc)); avisos.push("<strong>" + escapeHtml(f.k) + ":</strong> " + escapeHtml(f.calc)); }
    const icono = f.ok ? (marcas.length ? marcas.join(" ") : `<span style="color:#2e8b57; font-weight:700;">✔</span>`) : `<span class="muted">–</span>`;
    return `<div style="display:flex; align-items:center; gap:8px; padding:4px 0; border-bottom:1px solid var(--line);">
      <span style="width:42px; text-align:center; flex:none;">${icono}</span>
      <span style="flex:1; min-width:0;">${escapeHtml(f.k)}<span class="muted" style="display:block; font-size:11px; font-family:var(--mono); overflow:hidden; text-overflow:ellipsis;">${escapeHtml(f.det || "")}</span></span>
    </div>`;
  }).join("");
  return `<div style="margin-top:8px;">${html}
    ${avisos.length ? `<div class="muted" style="font-size:12px; margin-top:6px; line-height:1.5;">${avisos.map((a) => monoTriangulo(a.includes("calculadas") ? "?" : "!", "") + " " + a).join("<br>")}</div>` : ""}
    <div class="muted" style="font-size:11px; margin-top:6px;"><span style="color:#2e8b57; font-weight:700;">✔</span> ingresado · – falta · ${monoTriangulo("!", "repetido")} repetido en el proyecto · ${monoTriangulo("?", "calculado")} calculado por la app</div></div>`;
}
function monoAvisosCorto(m) {
  const f = monoResumenDatos(m);
  const nDup = f.filter((x) => x.dup).length, nCalc = f.filter((x) => x.calc).length, nFalta = f.filter((x) => !x.ok).length;
  return (nDup ? monoTriangulo("!", "hay datos repetidos") : "") + (nCalc ? monoTriangulo("?", "hay datos calculados por la app") : "") + (nFalta ? `<span class="muted" style="font-size:11px;"> faltan ${nFalta}</span>` : ` <span style="color:#2e8b57; font-weight:700;">✔</span>`);
}
